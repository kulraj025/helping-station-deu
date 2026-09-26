import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  buildPrizeSlots,
  createSelectionEntropy,
  selectionCommitHash,
  selectWinners,
  snapshotHash,
  verifySelection,
  type PoolCandidate,
  type WinnerAssignment,
} from "@/lib/draw";
import { parseEventSettings } from "@/lib/event-settings";
import { maskName } from "@/lib/privacy";
import { AUDIT_ACTIONS, writeAudit } from "./audit";
import { getEventById } from "./event-service";

/**
 * The official draw.
 *
 * Rules enforced here (not in the UI):
 *  1. Only `ELIGIBLE` + `CONFIRMED` registrations can enter the pool.
 *  2. The pool is snapshotted and hashed when it is locked; the draw then reads
 *     the snapshot, never the live table.
 *  3. Selection happens on the server with a CSPRNG.
 *  4. A completed draw is immutable. Mistakes are corrected with an appended
 *     `DrawCorrection`, never by overwriting.
 *  5. One participant can hold at most one prize per event unless the event
 *     settings explicitly allow more.
 */

export class DrawError extends Error {
  constructor(
    message: string,
    readonly code:
      | "EVENT_NOT_FOUND"
      | "REGISTRATION_OPEN"
      | "NO_ELIGIBLE"
      | "NO_PRIZES"
      | "POOL_ALREADY_LOCKED"
      | "POOL_NOT_LOCKED"
      | "ALREADY_DRAWN"
      | "ALREADY_RUNNING"
      | "NOT_COMPLETED"
      | "MISSING_DRAW",
  ) {
    super(message);
    this.name = "DrawError";
  }
}

export interface EligibleRow {
  id: string;
  entryNumber: string;
  participationStatus: string;
  drawEligibility: string;
  drawConsentAt: Date | null;
  registrationStatus: string;
}

/** Registrations that may enter the draw, in entry-number order. */
export function buildEligibleWhere(eventId: string, requireParticipation: boolean) {
  return {
    eventId,
    registrationStatus: "CONFIRMED",
    drawEligibility: "ELIGIBLE",
    ...(requireParticipation ? { participationStatus: "PARTICIPATED" } : {}),
  } as const;
}

export async function fetchEligiblePool(eventId: string, requireParticipation: boolean) {
  return prisma.registration.findMany({
    where: buildEligibleWhere(eventId, requireParticipation),
    orderBy: { entryNumber: "asc" },
    select: { id: true, entryNumber: true, participationStatus: true, drawEligibility: true, drawConsentAt: true, registrationStatus: true },
  });
}

export interface DrawCounts {
  confirmed: number;
  participated: number;
  eligible: number;
  pending: number;
  ineligible: number;
  noShow: number;
  eligibleWithoutDrawConsent: number;
  prizeSlots: number;
  prizesConfigured: number;
}

export async function getDrawCounts(eventId: string): Promise<DrawCounts> {
  const event = await getEventById(eventId);
  const settings = parseEventSettings(event?.settings);
  const requireParticipation = settings.requireParticipationForEligibility;

  const [confirmed, participated, eligible, pending, ineligible, noShow, prizes] = await Promise.all([
    prisma.registration.count({ where: { eventId, registrationStatus: "CONFIRMED" } }),
    prisma.registration.count({ where: { eventId, participationStatus: "PARTICIPATED" } }),
    prisma.registration.count({ where: buildEligibleWhere(eventId, requireParticipation) }),
    prisma.registration.count({ where: { eventId, drawEligibility: "PENDING" } }),
    prisma.registration.count({ where: { eventId, drawEligibility: "INELIGIBLE" } }),
    prisma.registration.count({ where: { eventId, participationStatus: "NO_SHOW" } }),
    prisma.prize.findMany({ where: { eventId }, select: { id: true, name: true, order: true, quantity: true } }),
  ]);

  const eligibleWithoutDrawConsent = await prisma.registration.count({
    where: { ...buildEligibleWhere(eventId, requireParticipation), drawConsentAt: null },
  });

  return {
    confirmed,
    participated,
    eligible,
    pending,
    ineligible,
    noShow,
    eligibleWithoutDrawConsent,
    prizesConfigured: prizes.length,
    prizeSlots: prizes.reduce((sum, prize) => sum + prize.quantity, 0),
  };
}

// ---------------------------------------------------------------------------
// Pool locking
// ---------------------------------------------------------------------------

export async function lockPool(eventId: string, adminId: string, options: { official: boolean }) {
  const event = await getEventById(eventId);
  if (!event) throw new DrawError("Event not found.", "EVENT_NOT_FOUND");
  if (event.status === "PUBLISHED") {
    throw new DrawError(
      "Close registration before locking the participant list.",
      "REGISTRATION_OPEN",
    );
  }

  const existing = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: options.official } },
  });
  if (existing && existing.status !== "CANCELLED") {
    throw new DrawError("The participant list is already locked for this draw.", "POOL_ALREADY_LOCKED");
  }

  const settings = parseEventSettings(event.settings);
  const pool = await fetchEligiblePool(eventId, settings.requireParticipationForEligibility);
  if (pool.length === 0) {
    throw new DrawError("There are currently no eligible participants for this draw.", "NO_ELIGIBLE");
  }

  const prizes = await prisma.prize.findMany({
    where: { eventId },
    select: { id: true, name: true, order: true, quantity: true },
  });

  const poolHash = snapshotHash(pool.map((row) => row.entryNumber));

  return prisma.$transaction(async (tx) => {
    const draw = existing
      ? await tx.draw.update({
          where: { id: existing.id },
          data: { status: "LOCKED", poolLockedAt: new Date(), eligibleParticipantCount: pool.length, poolSnapshotHash: poolHash },
        })
      : await tx.draw.create({
          data: {
            eventId,
            official: options.official,
            status: "LOCKED",
            initiatedById: adminId,
            poolLockedAt: new Date(),
            eligibleParticipantCount: pool.length,
            poolSnapshotHash: poolHash,
          },
        });

    // Freeze the pool into an immutable snapshot.
    await tx.drawPoolEntry.deleteMany({ where: { drawId: draw.id } });
    await tx.drawPoolEntry.createMany({
      data: pool.map((row, index) => ({
        drawId: draw.id,
        registrationId: row.id,
        entryNumber: row.entryNumber,
        sequence: index + 1,
      })),
    });

    if (options.official) {
      await tx.event.update({ where: { id: eventId }, data: { status: "IN_PROGRESS" } });
    }

    await tx.auditLog.create({
      data: {
        action: AUDIT_ACTIONS.poolLocked,
        eventId,
        drawId: draw.id,
        adminId,
        targetType: "Draw",
        targetId: draw.id,
        metadata: { eligible: pool.length, poolHash, prizeCount: prizes.length },
      },
    });

    return { drawId: draw.id, eligible: pool.length, poolHash, prizes: prizes.length };
  });
}

// ---------------------------------------------------------------------------
// Running the draw
// ---------------------------------------------------------------------------

export interface DrawRunResult {
  drawId: string;
  status: "COMPLETED";
  official: boolean;
  eligibleCount: number;
  totalSlots: number;
  assignments: WinnerAssignment[];
  shortfall: number;
  selectionDigest: string;
  entropy: string;
  poolHash: string;
}

export async function runDraw(options: {
  eventId: string;
  adminId: string;
  official: boolean;
  idempotencyKey: string;
  ipHash?: string;
}): Promise<DrawRunResult> {
  const { eventId, adminId, official, idempotencyKey } = options;
  const event = await getEventById(eventId);
  if (!event) throw new DrawError("Event not found.", "EVENT_NOT_FOUND");
  const settings = parseEventSettings(event.settings);

  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official } },
    include: { poolEntries: { orderBy: { sequence: "asc" } } },
  });
  if (!draw) throw new DrawError("Lock the participant list first.", "POOL_NOT_LOCKED");
  if (draw.status === "COMPLETED" && official) {
    throw new DrawError("This event already has an official draw result.", "ALREADY_DRAWN");
  }
  if (draw.status === "IN_PROGRESS") {
    throw new DrawError("A draw is already running for this event.", "ALREADY_RUNNING");
  }
  if (draw.poolLockedAt === null || draw.poolSnapshotHash === null) {
    throw new DrawError("The participant list is not locked yet.", "POOL_NOT_LOCKED");
  }

  const prizes = await prisma.prize.findMany({
    where: { eventId },
    select: { id: true, name: true, order: true, quantity: true },
  });
  const slots = buildPrizeSlots(prizes);
  if (slots.length === 0) {
    throw new DrawError("Configure at least one prize before starting the draw.", "NO_PRIZES");
  }

  // Winners from earlier official draws of the same event (one win per event rule).
  const previousWinners = official
    ? await prisma.winner.findMany({
        where: { eventId, claimStatus: { not: "REVOKED" } },
        select: { registrationId: true },
      })
    : [];
  const alreadyWon = new Set(previousWinners.map((row) => row.registrationId));
  const allowMultipleWins = settings.allowMultipleWinsPerParticipant;

  const pool: PoolCandidate[] = draw.poolEntries.map((entry) => ({
    registrationId: entry.registrationId,
    entryNumber: entry.entryNumber,
  }));
  if (pool.length === 0) {
    throw new DrawError("There are currently no eligible participants for this draw.", "NO_ELIGIBLE");
  }

  // --- 1. entropy + commitment (published before selection) ---------------
  const entropy = createSelectionEntropy();
  const poolHash = draw.poolSnapshotHash;
  const commitHash = selectionCommitHash({ drawId: draw.id, poolHash, entropy });

  await prisma.draw.update({
    where: { id: draw.id },
    data: { status: "IN_PROGRESS", startedAt: new Date(), selectionDigest: commitHash, idempotencyKey },
  });

  try {
    // --- 2. selection (CSPRNG, server side, deterministic for auditing) ----
    const result = selectWinners({
      pool,
      slots,
      entropy,
      isBlocked: allowMultipleWins ? undefined : (candidate) => alreadyWon.has(candidate.registrationId),
    });

    // --- 3. persist results ------------------------------------------------
    const registrations = await prisma.registration.findMany({
      where: { id: { in: result.assignments.map((a) => a.registrationId) } },
      select: {
        id: true,
        entryNumber: true,
        user: { select: { name: true, department: true } },
        publicDisplayConsent: true,
      },
    });
    const byId = new Map(registrations.map((row) => [row.id, row]));

    await prisma.$transaction(async (tx) => {
      if (official) {
        await tx.winner.createMany({
          data: result.assignments.map((assignment) => {
            const registration = byId.get(assignment.registrationId);
            return {
              drawId: draw.id,
              eventId,
              prizeId: assignment.prizeId,
              registrationId: assignment.registrationId,
              entryNumber: assignment.entryNumber,
              // Only a masked name is ever persisted for public display.
              displayName: maskName(registration?.user.name ?? "Participant"),
              department: registration?.user.department ?? null,
              claimStatus: "PENDING",
              isDemo: env.demoMode,
            };
          }),
        });
        await tx.drawPoolEntry.updateMany({
          where: { drawId: draw.id, registrationId: { in: result.assignments.map((a) => a.registrationId) } },
          data: { isWinner: true },
        });
      }

      await tx.draw.update({
        where: { id: draw.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          eligibleParticipantCount: pool.length,
          totalPrizeSlots: slots.length,
          selectionEntropy: entropy,
          ...(official
            ? {}
            : {
                // Rehearsal runs publish a masked preview only.
                previewResult: {
                  assignments: result.assignments.map((a) => ({
                    entryNumber: a.entryNumber,
                    prizeName: a.prizeName,
                    prizeOrder: a.prizeOrder,
                  })),
                  notSelectedCount: result.notSelected.length,
                },
              }),
        },
      });

      if (official) {
        await tx.auditLog.create({
          data: {
            action: AUDIT_ACTIONS.drawCompleted,
            eventId,
            drawId: draw.id,
            adminId,
            targetType: "Draw",
            targetId: draw.id,
            metadata: {
              eligible: pool.length,
              slots: slots.length,
              winners: result.assignments.length,
              shortfall: slots.length - result.assignments.length,
              poolHash,
              commitHash,
              entryNumbers: result.assignments.map((a) => a.entryNumber),
            },
            ipHash: options.ipHash,
          },
        });
      }
    });

    return {
      drawId: draw.id,
      status: "COMPLETED" as const,
      official,
      eligibleCount: pool.length,
      totalSlots: slots.length,
      assignments: result.assignments,
      shortfall: slots.length - result.assignments.length,
      selectionDigest: commitHash,
      entropy,
      poolHash,
    };
  } catch (error) {
    await prisma.draw.update({
      where: { id: draw.id },
      data: { status: "LOCKED", selectionEntropy: null, selectionDigest: null },
    });
    await writeAudit({
      action: AUDIT_ACTIONS.drawFailed,
      eventId,
      drawId: draw.id,
      adminId,
      metadata: { message: error instanceof Error ? error.message : "unknown error" },
      ipHash: options.ipHash,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public draw state (no personal data)
// ---------------------------------------------------------------------------

export interface PublicWinnerRow {
  id: string;
  entryNumber: string;
  displayName: string | null;
  department: string | null;
  prizeName: string;
  prizeOrder: number;
  selectedAt: string;
}

export interface PublicDrawState {
  event: { id: string; name: string; slug: string; isDemo: boolean };
  status: "NOT_STARTED" | "LOCKED" | "IN_PROGRESS" | "COMPLETED";
  officialDraw: boolean;
  eligibleCount: number;
  totalSlots: number;
  prizes: Array<{ name: string; quantity: number; order: number }>;
  lockedAt: string | null;
  poolHash: string | null;
  results: PublicWinnerRow[];
  integrity: { commitHash: string; poolHash: string; entropy: string | null } | null;
  visibility: { drawScreen: boolean; winners: boolean };
  updatedAt: string;
}

export async function getPublicDrawState(eventId: string): Promise<PublicDrawState | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const settings = parseEventSettings(event.settings);

  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    include: {
      winners: {
        include: { prize: { select: { name: true, order: true } } },
        orderBy: [{ prize: { order: "asc" } }, { selectedAt: "asc" }],
      },
    },
  });
  const prizes = await prisma.prize.findMany({
    where: { eventId },
    orderBy: { order: "asc" },
    select: { name: true, quantity: true, order: true },
  });

  const completed = draw?.status === "COMPLETED";
  const results: PublicWinnerRow[] = completed
    ? draw.winners
        .filter((winner) => winner.claimStatus !== "REVOKED")
        .map((winner) => ({
          id: winner.id,
          entryNumber: winner.entryNumber,
          displayName:
            settings.winnerDisplayMode === "MASKED" ? winner.displayName : null,
          department: winner.department,
          prizeName: winner.prize.name,
          prizeOrder: winner.prize.order,
          selectedAt: winner.selectedAt.toISOString(),
        }))
    : [];

  return {
    event: { id: event.id, name: event.name, slug: event.slug, isDemo: event.isDemo },
    status: draw ? (draw.status as PublicDrawState["status"]) : "NOT_STARTED",
    officialDraw: true,
    eligibleCount: draw?.eligibleParticipantCount ?? 0,
    totalSlots: prizes.reduce((sum, prize) => sum + prize.quantity, 0),
    prizes,
    lockedAt: draw?.poolLockedAt?.toISOString() ?? null,
    poolHash: draw?.poolSnapshotHash ?? null,
    results,
    integrity:
      draw && completed && draw.selectionDigest
        ? {
            commitHash: draw.selectionDigest,
            poolHash: draw.poolSnapshotHash ?? "",
            // The raw entropy is only revealed once the draw is complete.
            entropy: draw.selectionEntropy,
          }
        : null,
    visibility: {
      drawScreen: settings.publicDrawScreenVisible,
      winners: settings.publicWinnersVisible,
    },
    updatedAt: (draw?.updatedAt ?? event.updatedAt).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

export async function verifyDrawIntegrity(drawId: string) {
  const draw = await prisma.draw.findFirst({
    where: { id: drawId },
    include: { poolEntries: { orderBy: { sequence: "asc" } }, winners: true },
  });
  if (!draw) throw new DrawError("Draw not found.", "MISSING_DRAW");
  if (draw.status !== "COMPLETED" || !draw.selectionEntropy || !draw.selectionDigest) {
    throw new DrawError("This draw is not complete yet.", "NOT_COMPLETED");
  }

  const verification = verifySelection({
    drawId: draw.id,
    poolEntryNumbers: draw.poolEntries.map((entry) => entry.entryNumber),
    entropy: draw.selectionEntropy,
    expectedCommitHash: draw.selectionDigest,
  });

  const winnerEntryNumbers = draw.winners.map((winner) => winner.entryNumber);
  const reproduced = verification.recomputedPermutation.filter((entryNumber) =>
    winnerEntryNumbers.includes(entryNumber),
  );
  const matches = [...winnerEntryNumbers].sort().join(",") === [...reproduced].sort().join(",");

  return {
    drawId: draw.id,
    // The event the draw belongs to. Callers that write an audit row need this:
    // `AuditLog.eventId` is a foreign key to `Event.id`, not to `Draw.id`.
    eventId: draw.eventId,
    commitMatches: verification.commitMatches,
    poolHashMatches: verification.snapshotMatchesHash === draw.poolSnapshotHash,
    winnersMatch: matches,
    winnerEntryNumbers,
    reproducedEntryNumbers: reproduced,
  };
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

export async function revokeWinner(input: {
  winnerId: string;
  reason: string;
  details?: string;
  adminId: string;
  ipHash?: string;
}) {
  const winner = await prisma.winner.findUnique({ where: { id: input.winnerId } });
  if (!winner) throw new DrawError("Winner not found.", "MISSING_DRAW");
  if (winner.claimStatus === "REVOKED") return winner;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.winner.update({
      where: { id: input.winnerId },
      data: { claimStatus: "REVOKED", revokedAt: new Date(), revokedReason: input.reason },
    });
    await tx.drawCorrection.create({
      data: {
        drawId: winner.drawId,
        winnerId: winner.id,
        registrationId: winner.registrationId,
        type: "REVOKE_WINNER",
        reason: input.reason,
        details: input.details ?? null,
        createdById: input.adminId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: AUDIT_ACTIONS.winnerRevoked,
        eventId: winner.eventId,
        drawId: winner.drawId,
        adminId: input.adminId,
        targetType: "Winner",
        targetId: winner.id,
        metadata: { entryNumber: winner.entryNumber, reason: input.reason },
        ipHash: input.ipHash,
      },
    });
    return updated;
  });
}

export async function annotateWinner(input: {
  winnerId: string;
  reason: string;
  details?: string;
  adminId: string;
}) {
  const winner = await prisma.winner.findUnique({ where: { id: input.winnerId } });
  if (!winner) throw new DrawError("Winner not found.", "MISSING_DRAW");
  return prisma.$transaction(async (tx) => {
    const correction = await tx.drawCorrection.create({
      data: {
        drawId: winner.drawId,
        winnerId: winner.id,
        registrationId: winner.registrationId,
        type: "ANNOTATE",
        reason: input.reason,
        details: input.details ?? null,
        createdById: input.adminId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: AUDIT_ACTIONS.winnerAnnotated,
        eventId: winner.eventId,
        drawId: winner.drawId,
        adminId: input.adminId,
        targetType: "Winner",
        targetId: winner.id,
        metadata: { entryNumber: winner.entryNumber },
      },
    });
    return correction;
  });
}

/** Delete the most recent rehearsal draw so it can be run again. */
export async function resetTestDraw(eventId: string, adminId: string) {
  const draw = await prisma.draw.findUnique({ where: { eventId_official: { eventId, official: false } } });
  if (!draw) return { removed: false };
  if (draw.status === "COMPLETED" && draw.official) return { removed: false };
  await prisma.draw.delete({ where: { id: draw.id } });
  await writeAudit({
    action: AUDIT_ACTIONS.testDrawReset,
    eventId,
    drawId: draw.id,
    adminId,
    metadata: { previousStatus: draw.status },
  });
  return { removed: true };
}
