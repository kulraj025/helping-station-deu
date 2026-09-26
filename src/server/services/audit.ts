import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Append-only audit trail.
 *
 * Every state change that affects eligibility, prizes or draw results is
 * recorded here. Metadata must stay small and free of raw personal data —
 * store entry numbers, counts and status transitions, not names or e-mails.
 */
export interface AuditInput {
  action: string;
  eventId?: string | null;
  drawId?: string | null;
  adminId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | undefined;
  ipHash?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        eventId: input.eventId ?? null,
        drawId: input.drawId ?? null,
        adminId: input.adminId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? undefined,
        ipHash: input.ipHash ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the user-facing operation, but it must be loud
    // in the server log.
    console.error("[audit] failed to write audit log", input.action, error);
  }
}

export const AUDIT_ACTIONS = {
  registrationCreated: "registration.created",
  registrationDuplicate: "registration.duplicate_blocked",
  registrationCancelled: "registration.cancelled",
  participationVerified: "registration.participation_verified",
  eligibilityChanged: "registration.eligibility_changed",
  bulkEligibilityChanged: "registration.eligibility_bulk_changed",
  eventCreated: "event.created",
  eventUpdated: "event.updated",
  eventStatusChanged: "event.status_changed",
  prizesConfigured: "prizes.configured",
  prizeUpdated: "prize.updated",
  prizeDeleted: "prize.deleted",
  poolLocked: "draw.pool_locked",
  drawStarted: "draw.started",
  drawCompleted: "draw.completed",
  drawVerified: "draw.integrity_verified",
  drawFailed: "draw.failed",
  testDrawReset: "draw.test_reset",
  winnerRevoked: "winner.revoked",
  winnerAnnotated: "winner.annotated",
  winnerClaimUpdated: "winner.claim_updated",
  winnerNotified: "winner.notified",
  exportGenerated: "report.exported",
  adminLogin: "auth.admin_login",
  qrDownloaded: "event.qr_downloaded",
  posterDownloaded: "event.poster_downloaded",
} as const;
