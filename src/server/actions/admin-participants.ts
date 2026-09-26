"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { z } from "zod";
import { isEligibilityStatus, isParticipationStatus } from "@/lib/constants";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import { withEvent } from "@/server/admin/scope";
import type { ParticipantActionState } from "@/lib/action-state";
import { revalidateDrawCaches } from "./revalidate-draw";

/**
 * Participant and eligibility administration.
 *
 * Every status change requires a reason and is written to the audit log with the
 * before/after values, because eligibility is the thing that decides who can
 * win. Bulk changes are capped so a mistake cannot rewrite an entire event in
 * one click.
 */

/** A locked pool freezes eligibility too — these actions check it. */
async function assertPoolUnlocked(eventId: string): Promise<string | null> {
  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    select: { poolLockedAt: true },
  });
  return draw?.poolLockedAt
    ? "The participant pool is locked for the draw, so registrations can no longer be changed. Use a correction on the winners page instead."
    : null;
}

const singleSchema = z.object({
  registrationId: z.string().min(1),
  participationStatus: z.string().min(1),
  drawEligibility: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function updateParticipantAction(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const registrationId = String(formData.get("registrationId") ?? "");
  const admin = await requireAdmin("/admin/participants");

  const parsed = singleSchema.safeParse({
    registrationId,
    participationStatus: formData.get("participationStatus"),
    drawEligibility: formData.get("drawEligibility"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isParticipationStatus(parsed.data.participationStatus)) {
    return { status: "error", message: "Unknown participation status." };
  }
  if (!isEligibilityStatus(parsed.data.drawEligibility)) {
    return { status: "error", message: "Unknown eligibility status." };
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventId: true,
      participationStatus: true,
      drawEligibility: true,
      eligibilityReason: true,
      verifiedAt: true,
      event: { select: { slug: true } },
    },
  });
  if (!existing) return { status: "error", message: "Registration not found." };

  const locked = await assertPoolUnlocked(existing.eventId);
  if (locked) return { status: "error", message: locked };

  const participated = parsed.data.participationStatus === "PARTICIPATED";
  const updated = await prisma.registration.update({
    where: { id: registrationId },
    data: {
      participationStatus: parsed.data.participationStatus,
      drawEligibility: parsed.data.drawEligibility,
      eligibilityReason: parsed.data.reason?.trim() ? parsed.data.reason.trim() : null,
      verifiedAt: participated ? (existing.verifiedAt ?? new Date()) : existing.verifiedAt,
    },
    select: { participationStatus: true, drawEligibility: true },
  });

  const changes: Record<string, { from: string; to: string }> = {};
  if (existing.participationStatus !== updated.participationStatus) {
    changes.participationStatus = {
      from: existing.participationStatus,
      to: updated.participationStatus,
    };
    await writeAudit({
      action: AUDIT_ACTIONS.participationVerified,
      eventId: existing.eventId,
      adminId: admin.id,
      targetType: "Registration",
      targetId: registrationId,
      metadata: { from: existing.participationStatus, to: updated.participationStatus },
      ipHash: await getClientIpHash(),
    });
  }
  if (existing.drawEligibility !== updated.drawEligibility) {
    changes.drawEligibility = { from: existing.drawEligibility, to: updated.drawEligibility };
  }

  if (Object.keys(changes).length > 0) {
    await writeAudit({
      action: AUDIT_ACTIONS.eligibilityChanged,
      eventId: existing.eventId,
      adminId: admin.id,
      targetType: "Registration",
      targetId: registrationId,
      metadata: { changes, reason: parsed.data.reason?.trim() || null },
      ipHash: await getClientIpHash(),
    });
  }

  revalidatePath(withEvent("/admin/participants", existing.eventId));
  revalidatePath(withEvent("/admin/eligibility", existing.eventId));
  revalidatePath("/");
  revalidateDrawCaches(existing.eventId);

  return {
    status: "success",
    message: "Participant updated.",
    changedCount: Object.keys(changes).length,
  };
}

const bulkSchema = z.object({
  eventId: z.string().min(1),
  participationStatus: z.string().optional(),
  drawEligibility: z.string().optional(),
  reason: z.string().max(300).optional(),
  registrationIds: z.array(z.string().min(1)).min(1).max(200),
});

/** Attendance confirm / eligibility bulk actions, capped at 200 rows. */
export async function bulkUpdateParticipantsAction(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const admin = await requireAdmin("/admin/eligibility");

  const parsed = bulkSchema.safeParse({
    eventId: formData.get("eventId"),
    participationStatus: formData.get("participationStatus") || undefined,
    drawEligibility: formData.get("drawEligibility") || undefined,
    reason: formData.get("reason") ?? undefined,
    registrationIds: formData.getAll("registrationIds").map(String),
  });
  if (!parsed.success) {
    return { status: "error", message: "Select at least one participant to update." };
  }

  const { eventId, registrationIds } = parsed.data;
  const participation = parsed.data.participationStatus ?? null;
  const eligibility = parsed.data.drawEligibility ?? null;
  if (!participation && !eligibility) {
    return { status: "error", message: "Choose at least one status to apply." };
  }
  if (participation && !isParticipationStatus(participation)) {
    return { status: "error", message: "Unknown participation status." };
  }
  if (eligibility && !isEligibilityStatus(eligibility)) {
    return { status: "error", message: "Unknown eligibility status." };
  }

  const locked = await assertPoolUnlocked(eventId);
  if (locked) return { status: "error", message: locked };

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.registration.findMany({
      where: { id: { in: registrationIds }, eventId },
      select: { id: true, participationStatus: true, drawEligibility: true },
    });

    let changed = 0;
    for (const row of rows) {
      const data: {
        participationStatus?: string;
        drawEligibility?: string;
        eligibilityReason?: string | null;
        verifiedAt?: Date | null;
      } = {};
      if (participation && participation !== row.participationStatus) {
        data.participationStatus = participation;
        if (participation === "PARTICIPATED") data.verifiedAt = new Date();
        changed += 1;
      }
      if (eligibility && eligibility !== row.drawEligibility) {
        data.drawEligibility = eligibility;
        changed += 1;
      }
      if (Object.keys(data).length === 0) continue;
      if (parsed.data.reason?.trim()) data.eligibilityReason = parsed.data.reason.trim();
      await tx.registration.update({ where: { id: row.id }, data });
    }
    return changed;
  });

  await writeAudit({
    action: AUDIT_ACTIONS.bulkEligibilityChanged,
    eventId,
    adminId: admin.id,
    targetType: "Registration",
    targetId: null,
    metadata: {
      requested: registrationIds.length,
      changed: result,
      participationStatus: participation,
      drawEligibility: eligibility,
      reason: parsed.data.reason?.trim() || null,
    },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/participants", eventId));
  revalidatePath(withEvent("/admin/eligibility", eventId));
  revalidatePath("/");
  revalidateDrawCaches(eventId);

  return {
    status: "success",
    message:
      result === 0
        ? "No changes were needed — those participants already had these statuses."
        : `Updated ${result} field${result === 1 ? "" : "s"} across ${registrationIds.length} participant(s).`,
    changedCount: result,
  };
}

/** Cancel somebody's registration from the admin side. */
export async function cancelRegistrationAction(formData: FormData): Promise<void> {
  const registrationId = String(formData.get("registrationId") ?? "");
  const eventIdParam = String(formData.get("eventId") ?? "");
  const admin = await requireAdmin(withEvent("/admin/participants", eventIdParam || null));

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, eventId: true, registrationStatus: true, entryNumber: true },
  });
  if (!registration) {
    redirect(withEvent("/admin/participants?error=not-found", eventIdParam || null));
  }
  const eventId = registration.eventId;

  const locked = await assertPoolUnlocked(eventId);
  if (locked) {
    redirect(withEvent(`/admin/participants?error=${encodeURIComponent(locked)}`, eventId));
  }

  if (registration.registrationStatus !== "CANCELLED") {
    await prisma.registration.update({
      where: { id: registrationId },
      data: { registrationStatus: "CANCELLED" },
    });
    await writeAudit({
      action: AUDIT_ACTIONS.registrationCancelled,
      eventId,
      adminId: admin.id,
      targetType: "Registration",
      targetId: registrationId,
      metadata: { entryNumber: registration.entryNumber, byAdmin: true },
      ipHash: await getClientIpHash(),
    });
  }

  revalidatePath(withEvent("/admin/participants", eventId));
  revalidatePath(withEvent("/admin/eligibility", eventId));
  revalidatePath("/");
  revalidateDrawCaches(eventId);
  redirect(withEvent("/admin/participants?saved=cancelled", eventId));
}
