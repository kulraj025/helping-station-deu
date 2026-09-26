import "server-only";
import { prisma } from "@/lib/prisma";
import { parseEventSettings } from "@/lib/event-settings";
import { getPublicDrawState, type PublicWinnerRow } from "./draw-service";
import { getEventById } from "./event-service";
import { writeAudit, AUDIT_ACTIONS } from "./audit";

/**
 * Winner reads.
 *
 * The public projection is intentionally tiny: event, prize, entry number and
 * (only when the participant consented) a masked name. Departments are omitted
 * from the public winners list — they are not needed and are personal data.
 */

export interface PublicWinnerGroup {
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventDate: Date;
  locationName: string;
  drawId: string;
  completedAt: Date | null;
  winners: Array<{
    id: string;
    entryNumber: string;
    displayName: string | null;
    prizeName: string;
    prizeOrder: number;
    prizeQuantity: number;
    selectedAt: Date;
  }>;
  totalPrizes: number;
}

export async function getPublicWinnersForEvent(eventId: string): Promise<PublicWinnerGroup | null> {
  const event = await getEventById(eventId);
  if (!event) return null;
  const settings = parseEventSettings(event.settings);
  if (!settings.publicWinnersVisible) return null;

  const state = await getPublicDrawState(eventId);
  if (!state || state.results.length === 0) return null;

  const draw = await prisma.draw.findFirst({
    where: { eventId, official: true, status: "COMPLETED" },
    select: { id: true, completedAt: true },
  });

  const winners: PublicWinnerGroup["winners"] = state.results.map((row: PublicWinnerRow) => ({
    id: row.id,
    entryNumber: row.entryNumber,
    displayName: row.displayName,
    prizeName: row.prizeName,
    prizeOrder: row.prizeOrder,
    prizeQuantity: 0,
    selectedAt: new Date(row.selectedAt),
  }));

  return {
    eventId,
    eventName: event.name,
    eventSlug: event.slug,
    eventDate: event.startAt,
    locationName: event.locationName,
    drawId: draw?.id ?? "",
    completedAt: draw?.completedAt ?? null,
    winners,
    totalPrizes: state.totalSlots,
  };
}

/** Winner history across every event, newest first. */
export async function getWinnerHistory(limit = 50) {
  const events = await prisma.event.findMany({
    where: { status: { in: ["COMPLETED", "IN_PROGRESS", "REGISTRATION_CLOSED", "PUBLISHED"] } },
    orderBy: { startAt: "desc" },
    take: limit,
    select: { id: true, slug: true, name: true, startAt: true, settings: true, locationName: true },
  });

  const groups: PublicWinnerGroup[] = [];
  for (const event of events) {
    const group = await getPublicWinnersForEvent(event.id);
    if (group) groups.push(group);
  }
  return groups;
}

export interface AdminWinnerRow {
  id: string;
  entryNumber: string;
  displayName: string;
  fullName: string;
  email: string;
  phone: string | null;
  department: string;
  studentId: string;
  prizeName: string;
  prizeOrder: number;
  claimStatus: string;
  selectedAt: Date;
  notifiedAt: Date | null;
  claimedAt: Date | null;
  revokedReason: string | null;
  publicDisplayConsent: boolean;
  contactConsent: boolean;
  corrections: Array<{ id: string; type: string; reason: string; createdAt: Date }>;
}

export async function getAdminWinners(eventId: string): Promise<AdminWinnerRow[]> {
  const winners = await prisma.winner.findMany({
    where: { eventId },
    orderBy: [{ prizeId: "asc" }, { selectedAt: "asc" }],
    include: {
      prize: { select: { name: true, order: true } },
      registration: {
        select: {
          publicDisplayConsent: true,
          contactConsentAt: true,
          user: { select: { name: true, email: true, phone: true, department: true, studentId: true } },
        },
      },
      corrections: { select: { id: true, type: true, reason: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return winners.map((winner) => ({
    id: winner.id,
    entryNumber: winner.entryNumber,
    displayName: winner.displayName,
    fullName: winner.registration.user.name,
    email: winner.registration.user.email,
    phone: winner.registration.user.phone,
    department: winner.registration.user.department,
    studentId: winner.registration.user.studentId,
    prizeName: winner.prize.name,
    prizeOrder: winner.prize.order,
    claimStatus: winner.claimStatus,
    selectedAt: winner.selectedAt,
    notifiedAt: winner.notifiedAt,
    claimedAt: winner.claimedAt,
    revokedReason: winner.revokedReason,
    publicDisplayConsent: winner.registration.publicDisplayConsent,
    contactConsent: Boolean(winner.registration.contactConsentAt),
    corrections: winner.corrections,
  }));
}

export async function updateClaimStatus(input: {
  winnerId: string;
  claimStatus: "PENDING" | "NOTIFIED" | "CLAIMED" | "UNCLAIMED";
  adminId: string;
}) {
  const winner = await prisma.winner.findUnique({ where: { id: input.winnerId } });
  if (!winner) return null;
  if (winner.claimStatus === "REVOKED") return winner;

  const updated = await prisma.winner.update({
    where: { id: input.winnerId },
    data: {
      claimStatus: input.claimStatus,
      notifiedAt: input.claimStatus === "NOTIFIED" ? new Date() : winner.notifiedAt,
      claimedAt: input.claimStatus === "CLAIMED" ? new Date() : winner.claimedAt,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.winnerClaimUpdated,
    eventId: winner.eventId,
    drawId: winner.drawId,
    adminId: input.adminId,
    targetType: "Winner",
    targetId: winner.id,
    metadata: { entryNumber: winner.entryNumber, claimStatus: input.claimStatus },
  });

  return updated;
}
