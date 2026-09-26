import "server-only";
import { prisma } from "@/lib/prisma";
import { maskStudentId } from "@/lib/privacy";
import { parseEventSettings } from "@/lib/event-settings";
import { getEventById } from "./event-service";
import { writeAudit, AUDIT_ACTIONS } from "./audit";

/**
 * Admin participant management: search, filter, sort, paginate, verify.
 * The list projection is masked; full details are only returned by
 * `getParticipantDetail`, which is audited when called.
 */

export interface ParticipantFilters {
  eventId: string;
  query?: string;
  registrationStatus?: string;
  participationStatus?: string;
  drawEligibility?: string;
  page?: number;
  pageSize?: number;
  sort?: "entry" | "name" | "department" | "created" | "status";
  direction?: "asc" | "desc";
}

export interface ParticipantRow {
  id: string;
  entryNumber: string;
  name: string;
  maskedStudentId: string;
  department: string;
  emailDomain: string;
  participationStatus: string;
  drawEligibility: string;
  registrationStatus: string;
  volunteerRole: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  publicDisplayConsent: boolean;
  hasDrawConsent: boolean;
  isAcademicEmail: boolean;
  isDemo: boolean;
  hasWon: boolean;
}

export async function listParticipants(filters: ParticipantFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, filters.pageSize ?? 25));
  const query = filters.query?.trim();

  const where = {
    eventId: filters.eventId,
    ...(filters.registrationStatus ? { registrationStatus: filters.registrationStatus } : {}),
    ...(filters.participationStatus ? { participationStatus: filters.participationStatus } : {}),
    ...(filters.drawEligibility ? { drawEligibility: filters.drawEligibility } : {}),
    ...(query
      ? {
          OR: [
            { entryNumber: { contains: query, mode: "insensitive" as const } },
            { user: { name: { contains: query, mode: "insensitive" as const } } },
            { user: { studentId: { contains: query, mode: "insensitive" as const } } },
            { user: { email: { contains: query, mode: "insensitive" as const } } },
            { user: { department: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const orderBy =
    filters.sort === "name"
      ? { user: { name: filters.direction ?? "asc" as const } }
      : filters.sort === "department"
        ? { user: { department: filters.direction ?? "asc" as const } }
        : filters.sort === "created"
          ? { createdAt: filters.direction ?? "desc" as const }
          : filters.sort === "status"
            ? { drawEligibility: filters.direction ?? "asc" as const }
            : { entryNumber: filters.direction ?? "asc" as const };

  const [total, rows] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      orderBy: [orderBy as never],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { name: true, studentId: true, department: true, email: true, isDemo: true } },
        winners: { select: { id: true, claimStatus: true } },
      },
    }),
  ]);

  const participants: ParticipantRow[] = rows.map((row) => ({
    id: row.id,
    entryNumber: row.entryNumber,
    name: row.user.name,
    maskedStudentId: maskStudentId(row.user.studentId),
    department: row.user.department,
    emailDomain: row.user.email.split("@")[1] ?? "",
    participationStatus: row.participationStatus,
    drawEligibility: row.drawEligibility,
    registrationStatus: row.registrationStatus,
    volunteerRole: row.volunteerRole,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    publicDisplayConsent: row.publicDisplayConsent,
    hasDrawConsent: Boolean(row.drawConsentAt),
    isAcademicEmail: /\.(ac\.kr|ac\.jp|ac\.id|edu|edu\.au|edu\.cn|edu\.sg|univ)$/i.test(row.user.email),
    isDemo: row.isDemo,
    hasWon: row.winners.some((winner) => winner.claimStatus !== "REVOKED"),
  }));

  return { participants, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Full detail (unmasked) — used by the "view details" modal. */
export async function getParticipantDetail(registrationId: string) {
  const row = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      user: true,
      event: { select: { id: true, name: true } },
      winners: { include: { prize: { select: { name: true } } } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    entryNumber: row.entryNumber,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    studentId: row.user.studentId,
    department: row.user.department,
    volunteerRole: row.volunteerRole,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    registrationStatus: row.registrationStatus,
    participationStatus: row.participationStatus,
    drawEligibility: row.drawEligibility,
    eligibilityReason: row.eligibilityReason,
    rulesAcceptedAt: row.rulesAcceptedAt,
    dataConsentAt: row.dataConsentAt,
    drawConsentAt: row.drawConsentAt,
    contactConsentAt: row.contactConsentAt,
    publicDisplayConsent: row.publicDisplayConsent,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    eventName: row.event.name,
    prizes: row.winners.map((winner) => winner.prize.name),
  };
}

export interface ParticipantUpdate {
  registrationId: string;
  participationStatus?: string;
  drawEligibility?: string;
  eligibilityReason?: string;
}

export interface UpdateResult {
  updated: number;
  skippedLocked: number;
  entryNumbers: string[];
}

async function assertPoolUnlocked(eventId: string) {
  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    select: { status: true, poolLockedAt: true },
  });
  return !(draw && draw.poolLockedAt);
}

/**
 * Update one participant.
 *
 * Eligibility is refused once the official pool is locked — that is the whole
 * point of the lock.
 */
export async function updateParticipant(input: ParticipantUpdate & { adminId: string; ipHash?: string }) {
  const existing = await prisma.registration.findUnique({
    where: { id: input.registrationId },
    select: { eventId: true, entryNumber: true, participationStatus: true, drawEligibility: true },
  });
  if (!existing) return { ok: false as const, reason: "NOT_FOUND" as const };

  const event = await getEventById(existing.eventId);
  const settings = parseEventSettings(event?.settings);
  const unlocked = await assertPoolUnlocked(existing.eventId);

  if (!unlocked && (input.drawEligibility !== undefined || input.participationStatus !== undefined)) {
    return { ok: false as const, reason: "POOL_LOCKED" as const };
  }

  const nextParticipation = input.participationStatus ?? existing.participationStatus;
  let nextEligibility = input.drawEligibility ?? existing.drawEligibility;

  // Keep the two states consistent: eligibility always follows participation.
  if (settings.requireParticipationForEligibility) {
    if (nextEligibility === "ELIGIBLE" && nextParticipation !== "PARTICIPATED") {
      return { ok: false as const, reason: "NOT_PARTICIPATED" as const };
    }
    if (nextParticipation !== "PARTICIPATED" && nextEligibility === "ELIGIBLE") {
      nextEligibility = "PENDING";
    }
  }

  await prisma.registration.update({
    where: { id: input.registrationId },
    data: {
      participationStatus: input.participationStatus,
      drawEligibility: input.drawEligibility,
      eligibilityReason: input.eligibilityReason,
      ...(input.participationStatus === "PARTICIPATED"
        ? { verifiedAt: new Date(), verifiedById: input.adminId }
        : {}),
    },
  });

  await writeAudit({
    action:
      input.drawEligibility !== undefined || input.participationStatus !== undefined
        ? AUDIT_ACTIONS.participationVerified
        : AUDIT_ACTIONS.eligibilityChanged,
    eventId: existing.eventId,
    adminId: input.adminId,
    targetType: "Registration",
    targetId: input.registrationId,
    metadata: {
      entryNumber: existing.entryNumber,
      from: { participation: existing.participationStatus, eligibility: existing.drawEligibility },
      to: { participation: nextParticipation, eligibility: nextEligibility },
    },
    ipHash: input.ipHash,
  });

  return { ok: true as const };
}

export async function bulkUpdateParticipants(input: {
  eventId: string;
  registrationIds: string[];
  participationStatus?: string;
  drawEligibility?: string;
  adminId: string;
  ipHash?: string;
}): Promise<UpdateResult> {
  const unlocked = await assertPoolUnlocked(input.eventId);
  if (!unlocked) return { updated: 0, skippedLocked: input.registrationIds.length, entryNumbers: [] };

  const event = await getEventById(input.eventId);
  const settings = parseEventSettings(event?.settings);

  const rows = await prisma.registration.findMany({
    where: { id: { in: input.registrationIds }, eventId: input.eventId },
    select: { id: true, entryNumber: true, participationStatus: true, drawEligibility: true },
  });

  const updatable = rows.filter((row) => {
    if (!input.drawEligibility) return true;
    if (!settings.requireParticipationForEligibility) return true;
    if (input.drawEligibility !== "ELIGIBLE") return true;
    return (input.participationStatus ?? row.participationStatus) === "PARTICIPATED";
  });

  if (updatable.length > 0) {
    await prisma.registration.updateMany({
      where: { id: { in: updatable.map((row) => row.id) } },
      data: {
        participationStatus: input.participationStatus,
        drawEligibility: input.drawEligibility,
        ...(input.participationStatus === "PARTICIPATED" ? { verifiedAt: new Date() } : {}),
      },
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.bulkEligibilityChanged,
    eventId: input.eventId,
    adminId: input.adminId,
    targetType: "Registration",
    metadata: {
      requested: input.registrationIds.length,
      updated: updatable.length,
      skipped: input.registrationIds.length - updatable.length,
      participationStatus: input.participationStatus ?? null,
      drawEligibility: input.drawEligibility ?? null,
    },
    ipHash: input.ipHash,
  });

  return {
    updated: updatable.length,
    skippedLocked: input.registrationIds.length - updatable.length,
    entryNumbers: updatable.map((row) => row.entryNumber),
  };
}

/** Counts used by the eligibility dashboard. */
export async function getEligibilitySummary(eventId: string) {
  const event = await getEventById(eventId);
  const settings = parseEventSettings(event?.settings);
  const [byParticipation, byEligibility, confirmed] = await Promise.all([
    prisma.registration.groupBy({
      by: ["participationStatus"],
      where: { eventId, registrationStatus: "CONFIRMED" },
      _count: { _all: true },
    }),
    prisma.registration.groupBy({
      by: ["drawEligibility"],
      where: { eventId, registrationStatus: "CONFIRMED" },
      _count: { _all: true },
    }),
    prisma.registration.count({ where: { eventId, registrationStatus: "CONFIRMED" } }),
  ]);
  return {
    confirmed,
    byParticipation: Object.fromEntries(byParticipation.map((row) => [row.participationStatus, row._count._all])),
    byEligibility: Object.fromEntries(byEligibility.map((row) => [row.drawEligibility, row._count._all])),
    requireParticipation: settings.requireParticipationForEligibility,
  };
}
