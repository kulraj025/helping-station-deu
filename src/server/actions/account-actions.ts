"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { setPasswordSchema } from "@/lib/validation";
import { setUserPassword } from "@/server/services/registration-service";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import type { AccountState } from "@/lib/action-state";

/** Sign out and return to the home page. */
export async function signOutAction(): Promise<void> {
  const { signOut } = await import("@/auth");
  await signOut({ redirect: false });
  revalidatePath("/", "layout");
  redirect("/");
}

const cancelSchema = z.object({ registrationId: z.string().min(1) });

/**
 * Withdraw a registration.
 *
 * Allowed any time before the draw pool is locked. Once the pool is frozen the
 * registration stands, because the snapshot cannot be edited.
 */
export async function cancelRegistrationAction(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser("/account");

  const parsed = cancelSchema.safeParse({ registrationId: formData.get("registrationId") });
  if (!parsed.success) {
    return { status: "error", message: "That registration could not be found." };
  }

  const registration = await prisma.registration.findUnique({
    where: { id: parsed.data.registrationId },
    select: { id: true, userId: true, eventId: true, registrationStatus: true, event: { select: { slug: true } } },
  });
  if (!registration || registration.userId !== user.id) {
    return { status: "error", message: "That registration could not be found." };
  }
  if (registration.registrationStatus === "CANCELLED") {
    return { status: "error", message: "This registration is already cancelled." };
  }

  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId: registration.eventId, official: true } },
    select: { poolLockedAt: true },
  });
  if (draw?.poolLockedAt) {
    return {
      status: "error",
      message:
        "The participant list for this event has already been locked for the draw, so registrations can no longer be withdrawn. Please contact the organiser directly.",
    };
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: { registrationStatus: "CANCELLED" },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.registrationCancelled,
    eventId: registration.eventId,
    targetType: "Registration",
    targetId: registration.id,
    adminId: null,
    metadata: { byOwner: true },
    ipHash: await getClientIpHash(),
  });

  revalidatePath("/account");
  return { status: "success", message: "Your registration has been cancelled." };
}

/** First sign-in: turn a claim-code account into a password account. */
export async function setPasswordAction(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser("/account");

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the password requirements.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await setUserPassword(user.id, parsed.data.password);
  revalidatePath("/account");
  return {
    status: "success",
    message: "Password saved. You can now sign in with your e-mail and password from any device.",
  };
}
