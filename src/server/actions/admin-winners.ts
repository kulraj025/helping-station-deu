"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { isClaimStatus } from "@/lib/constants";
import { annotateWinner, revokeWinner } from "@/server/services/draw-service";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import { withEvent } from "@/server/admin/scope";
import type { WinnerActionState } from "@/lib/action-state";
import { revalidateDrawCaches } from "./revalidate-draw";

/**
 * Winner administration after a completed draw.
 *
 * A completed draw is immutable, so nothing here edits who won. Revoking and
 * annotating both *append* a `DrawCorrection`; the original winner row stays
 * exactly as the draw produced it, and the correction explains the difference.
 */

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Track the physical handover of a prize. */
export async function updateClaimStatusAction(
  _previous: WinnerActionState,
  formData: FormData,
): Promise<WinnerActionState> {
  const admin = await requireAdmin("/admin/winners");

  const winnerId = text(formData, "winnerId");
  const claimStatus = text(formData, "claimStatus");
  if (!winnerId) return { status: "error", message: "Missing winner." };
  if (!isClaimStatus(claimStatus)) return { status: "error", message: "Unknown claim status." };
  // REVOKED is only reachable through the correction flow, which demands a reason.
  if (claimStatus === "REVOKED") {
    return { status: "error", message: "Use the revoke action so a written reason is recorded." };
  }

  const winner = await prisma.winner.findUnique({
    where: { id: winnerId },
    select: { id: true, eventId: true, entryNumber: true, claimStatus: true, claimedAt: true },
  });
  if (!winner) return { status: "error", message: "Winner not found." };
  if (winner.claimStatus === claimStatus) {
    return { status: "error", message: "That is already the current claim status." };
  }

  await prisma.winner.update({
    where: { id: winner.id },
    data: {
      claimStatus,
      claimedAt: claimStatus === "CLAIMED" ? new Date() : winner.claimedAt,
      notifiedAt: claimStatus === "NOTIFIED" ? new Date() : undefined,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.winnerClaimUpdated,
    eventId: winner.eventId,
    adminId: admin.id,
    targetType: "Winner",
    targetId: winner.id,
    metadata: { entryNumber: winner.entryNumber, from: winner.claimStatus, to: claimStatus },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/winners", winner.eventId));
  revalidateDrawCaches(winner.eventId);
  return { status: "success", message: "Claim status updated." };
}

/** Revoke a prize, appending a correction with a mandatory written reason. */
export async function revokeWinnerAction(
  _previous: WinnerActionState,
  formData: FormData,
): Promise<WinnerActionState> {
  const admin = await requireAdmin("/admin/winners");

  const winnerId = text(formData, "winnerId");
  const reason = text(formData, "reason").trim();
  const details = text(formData, "details").trim();

  if (!winnerId) return { status: "error", message: "Missing winner." };
  if (reason.length < 10) {
    return {
      status: "error",
      message: "A written reason of at least 10 characters is required — it becomes part of the permanent record.",
      fieldErrors: { reason: ["Give a reason of at least 10 characters."] },
    };
  }

  const winner = await prisma.winner.findUnique({
    where: { id: winnerId },
    select: { id: true, eventId: true, entryNumber: true, claimStatus: true },
  });
  if (!winner) return { status: "error", message: "Winner not found." };
  if (winner.claimStatus === "REVOKED") {
    return { status: "error", message: "This prize has already been revoked." };
  }

  try {
    await revokeWinner({
      winnerId: winner.id,
      reason,
      details: details || undefined,
      adminId: admin.id,
      ipHash: await getClientIpHash(),
    });

    revalidatePath(withEvent("/admin/winners", winner.eventId));
    revalidatePath("/winners");
    revalidateDrawCaches(winner.eventId);

    return {
      status: "success",
      message:
        "Prize revoked. The original winner record is preserved and a correction was appended to the draw history.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "The revocation failed.",
    };
  }
}

/** Attach an organiser note to a winner result, e.g. a collection reminder. */
export async function annotateWinnerAction(
  _previous: WinnerActionState,
  formData: FormData,
): Promise<WinnerActionState> {
  const admin = await requireAdmin("/admin/winners");

  const winnerId = text(formData, "winnerId");
  const details = text(formData, "details").trim();
  if (!winnerId) return { status: "error", message: "Missing winner." };
  if (details.length < 3) {
    return {
      status: "error",
      message: "Write at least a few words so the note is useful later.",
      fieldErrors: { details: ["Write at least a few words."] },
    };
  }

  const winner = await prisma.winner.findUnique({
    where: { id: winnerId },
    select: { id: true, eventId: true, entryNumber: true },
  });
  if (!winner) return { status: "error", message: "Winner not found." };

  await annotateWinner({
    winnerId: winner.id,
    reason: "Organiser annotation",
    details,
    adminId: admin.id,
  });

  revalidatePath(withEvent("/admin/winners", winner.eventId));
  revalidateDrawCaches(winner.eventId);
  return { status: "success", message: "Note appended to the draw history." };
}

/**
 * Queue a winner notification.
 *
 * Delivery itself is a separate integration, so this records the intent as a
 * queued `Notification` row and audits it. Without the participant's contact
 * consent, the action is refused outright.
 */
export async function notifyWinnerAction(formData: FormData): Promise<void> {
  const winnerId = text(formData, "winnerId");
  const admin = await requireAdmin("/admin/winners");

  const winner = await prisma.winner.findUnique({
    where: { id: winnerId },
    select: {
      id: true,
      eventId: true,
      entryNumber: true,
      claimStatus: true,
      prize: { select: { name: true } },
      registration: {
        select: { contactConsentAt: true, user: { select: { email: true, name: true } } },
      },
    },
  });
  if (!winner) redirect("/admin/winners?error=not-found");
  const eventId = winner.eventId;

  if (!winner.registration.contactConsentAt) {
    redirect(withEvent("/admin/winners?error=no-consent", eventId));
  }

  await prisma.notification.create({
    data: {
      eventId,
      type: "WINNER_NOTIFIED",
      channel: "EMAIL",
      recipient: winner.registration.user.email,
      subject: "You have won a Helping Station DEU prize",
      body: `Congratulations ${winner.registration.user.name}. You have won “${winner.prize.name}” with entry number ${winner.entryNumber}. Bring your entry number and student ID to the organiser's desk to collect it.`,
      status: "QUEUED",
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.winnerNotified,
    eventId,
    adminId: admin.id,
    targetType: "Winner",
    targetId: winner.id,
    metadata: { entryNumber: winner.entryNumber, channel: "EMAIL" },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/winners", eventId));
  redirect(withEvent("/admin/winners?saved=notified", eventId));
}
