"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  DrawError,
  lockPool,
  resetTestDraw,
  runDraw,
  verifyDrawIntegrity,
} from "@/server/services/draw-service";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import { confirmationCode } from "@/lib/utils";
import type { DrawActionState } from "@/lib/action-state";
import { withEvent } from "@/server/admin/scope";
import { revalidateDrawCaches } from "./revalidate-draw";

/**
 * Draw operations.
 *
 * The two irreversible steps — locking the pool and running the draw — require
 * the organiser to type the word shown on screen. That is not security theatre;
 * it stops an accidental click from deciding an event's prizes.
 */

function messageFor(error: unknown): string {
  if (error instanceof DrawError) return error.message;
  if (error instanceof Error) return error.message;
  return "The draw operation failed.";
}

export async function lockPoolAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const admin = await requireAdmin(withEvent("/admin/draw", eventId));

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } });
  if (!event) return { status: "error", message: "Event not found." };

  const expected = confirmationCode(event.slug);
  if (code !== expected) {
    return {
      status: "error",
      message: `Confirmation code did not match. Type ${expected} exactly.`,
      code: expected,
    };
  }

  try {
    const result = await lockPool(eventId, admin.id, { official: true });
    revalidateDrawCaches(eventId);
    return {
      status: "success",
      message: `Pool locked. ${result.eligible} eligible ${
        result.eligible === 1 ? "entry" : "entries"
      } frozen into the snapshot, with ${result.prizes} prize slot(s).`,
    };
  } catch (error) {
    return { status: "error", message: messageFor(error) };
  }
}

export async function runDrawAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const admin = await requireAdmin(withEvent("/admin/draw", eventId));

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } });
  if (!event) return { status: "error", message: "Event not found." };

  const expected = confirmationCode(event.slug);
  if (code !== expected) {
    return {
      status: "error",
      message: `Confirmation code did not match. Type ${expected} exactly.`,
      code: expected,
    };
  }

  try {
    // The idempotency key is derived from the locked pool hash, so a double
    // click cannot run a second, different draw over the same snapshot.
    const draw = await prisma.draw.findUnique({
      where: { eventId_official: { eventId, official: true } },
      select: { id: true, poolSnapshotHash: true, status: true },
    });
    if (!draw) return { status: "error", message: "Lock the pool before running the draw." };

    const result = await runDraw({
      eventId,
      adminId: admin.id,
      official: true,
      idempotencyKey: `${draw.id}:${draw.poolSnapshotHash ?? "none"}`,
      ipHash: await getClientIpHash(),
    });
    revalidateDrawCaches(eventId);

    // Verify immediately so the organiser sees a green result, not a promise.
    const verification = await verifyDrawIntegrity(result.drawId).catch(() => null);

    const message =
      result.shortfall > 0
        ? `Draw complete. ${result.assignments.length} prize(s) awarded, but ${result.shortfall} slot(s) had no eligible entry left and went unclaimed. This result is now permanent.`
        : `Draw complete. ${result.assignments.length} prize(s) awarded. This result is now permanent.`;

    return {
      status: "success",
      message,
      winners: result.assignments.map((assignment) => ({
        entryNumber: assignment.entryNumber,
        prizeName: assignment.prizeName,
      })),
      verification,
    };
  } catch (error) {
    return { status: "error", message: messageFor(error) };
  }
}

export async function verifyDrawAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const drawId = String(formData.get("drawId") ?? "");
  const admin = await requireAdmin("/admin/draw");
  if (!drawId) return { status: "error", message: "No draw to verify." };

  try {
    const verification = await verifyDrawIntegrity(drawId);
    await writeAudit({
      action: AUDIT_ACTIONS.drawVerified,
      // The event, not the draw: `eventId` is a foreign key to `Event.id`.
      eventId: verification.eventId,
      drawId,
      adminId: admin.id,
      targetType: "Draw",
      targetId: drawId,
      metadata: {
        commitMatches: verification.commitMatches,
        poolHashMatches: verification.poolHashMatches,
        winnersMatch: verification.winnersMatch,
      },
      ipHash: await getClientIpHash(),
    });

    const ok = verification.commitMatches && verification.poolHashMatches && verification.winnersMatch;
    return {
      status: "success",
      message: ok
        ? "Verification passed. The published randomness reproduces exactly the recorded winners."
        : "Verification FAILED. The recorded result does not match the published randomness — escalate this immediately.",
      verification,
    };
  } catch (error) {
    return { status: "error", message: messageFor(error) };
  }
}

/**
 * Rehearsal reset.
 *
 * Only allowed on a *demo* event, and only when nothing has been announced: it
 * deletes the draw, its snapshot and its winners so a rehearsal can be run
 * again. Refused on a real event, permanently.
 */
export async function resetTestDrawAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const admin = await requireAdmin(withEvent("/admin/draw", eventId));

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, isDemo: true },
  });
  if (!event) redirect(withEvent("/admin/draw?error=notfound", eventId));

  if (!event.isDemo) {
    redirect(withEvent("/admin/draw?error=not-demo", eventId));
  }
  if (code !== confirmationCode(event.slug)) {
    redirect(withEvent("/admin/draw?error=bad-code", eventId));
  }

  const result = await resetTestDraw(eventId, admin.id);
  revalidateDrawCaches(eventId);
  redirect(
    withEvent(
      `/admin/draw?saved=${result.removed ? "rehearsal-reset" : "nothing-to-reset"}`,
      eventId,
    ),
  );
}
