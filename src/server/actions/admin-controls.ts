"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { saveSiteSettings } from "@/server/services/site-settings-service";
import { prettySwitchLabel, siteSettingsInputSchema } from "@/lib/site-settings";
import { writeAudit, AUDIT_ACTIONS } from "@/server/services/audit";
import type { AdminActionState } from "@/lib/action-state";

/**
 * Organiser controls: site section switches, and account deletion.
 *
 * Two features, one file, because they answer the same question — "I need to
 * change something about the running site and I am not going to run a deploy".
 *
 * The deletion actions are the dangerous ones, so their guard rails are spelled
 * out rather than assumed. Every one of them is reachable by any signed-in
 * admin, which in practice means: reachability is not a security control, and
 * the checks below are the only thing standing between a mis-click and an
 * unrecoverable deletion.
 */

/** Parse a checkbox, which is absent from the form body when it is unticked. */
function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

/**
 * Save the site-wide switches.
 *
 * The switches are read as "is this box ticked" rather than as a list of the
 * ones that changed, so an unticked box is written as `false` instead of being
 * silently left at its old value — the usual way a "save" form quietly drops a
 * setting.
 */
export async function updateSiteSettingsAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin("/admin/controls");

  const parsed = siteSettingsInputSchema.safeParse({
    siteOpen: checkbox(formData, "siteOpen"),
    registerOpen: checkbox(formData, "registerOpen"),
    winnersOpen: checkbox(formData, "winnersOpen"),
    drawOpen: checkbox(formData, "drawOpen"),
    rulesOpen: checkbox(formData, "rulesOpen"),
    showCount: checkbox(formData, "showCount"),
    closedNote: String(formData.get("closedNote") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Those settings could not be saved.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const before = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: {
      siteOpen: true,
      registerOpen: true,
      winnersOpen: true,
      drawOpen: true,
      rulesOpen: true,
      showCount: true,
    },
  });

  await saveSiteSettings(parsed.data, admin.id);

  // Only the switches that actually changed, so the audit log stays readable
  // months later when someone asks "who closed registration and when".
  const changed = Object.keys(parsed.data).filter(
    (key) =>
      key !== "closedNote" &&
      before &&
      before[key as keyof typeof before] !== parsed.data[key as keyof typeof parsed.data],
  );
  if (before && (changed.length > 0 || parsed.data.closedNote)) {
    await writeAudit({
      action: AUDIT_ACTIONS.siteSettingsChanged,
      adminId: admin.id,
      targetType: "SiteSettings",
      metadata: { changed, before, after: parsed.data },
    });
  }

  // Every public page reads these, so the whole site has to be revalidated, not
  // just the controls screen.
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: changed.length
      ? `Saved. Changed: ${changed.map(prettySwitchLabel).join(", ")}.`
      : "Saved.",
  };
}

/**
 * Delete one participant account.
 *
 * `Registration.user` is `onDelete: Cascade`, so this also removes that person's
 * registrations, and anything derived from them — their draw pool entries,
 * winners and corrections. That is usually what "delete this participant" means,
 * but it is destructive and irreversible, so the confirm dialog on the button
 * says so rather than leaving it implicit.
 *
 * Refuses to delete the account doing the deleting, and refuses to delete the
 * last remaining admin, which would lock every organiser out of the site with no
 * way back in short of a database edit.
 */
export async function deleteUserAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin("/admin/controls");
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return { status: "error", message: "No account was selected." };
  }

  if (userId === admin.id) {
    return {
      status: "error",
      message: "You cannot delete the account you are signed in with.",
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target) {
    return { status: "error", message: "That account no longer exists." };
  }

  if (target.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return {
        status: "error",
        message:
          "That is the only organiser account left. Create another organiser before deleting this one, or nobody could administer the site.",
      };
    }
  }

  const registrations = await prisma.registration.count({ where: { userId } });

  await prisma.user.delete({ where: { id: userId } });

  await writeAudit({
    action: AUDIT_ACTIONS.userDeleted,
    adminId: admin.id,
    targetType: "User",
    targetId: target.id,
    // The e-mail is recorded so the deletion can be traced, but no other
    // personal data is: see the note on `writeAudit`.
    metadata: { email: target.email, role: target.role, registrationsRemoved: registrations },
  });

  revalidatePath("/admin/controls");
  revalidatePath("/admin/participants");

  return {
    status: "success",
    message: `Deleted ${target.name}.${
      registrations > 0
        ? ` ${registrations} registration${registrations === 1 ? "" : "s"} removed with it.`
        : ""
    }`,
  };
}

/**
 * Delete every participant account, keeping organisers.
 *
 * This is the "start again" button for a site that collected test or duplicate
 * sign-ups. Organisers are deliberately kept: deleting them would leave nobody
 * able to administer the site, and the person pressing this button is one of
 * them.
 *
 * Events, prizes and the audit log are untouched — only student accounts and,
 * by cascade, the registrations attached to them.
 */
export async function deleteAllParticipantsAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin("/admin/controls");

  // A typed confirmation, so this cannot happen by a stray click on a phone.
  // `formData.get` on a missing field is null, which fails this check.
  if (String(formData.get("confirm") ?? "") !== "DELETE") {
    return {
      status: "error",
      message: "Type DELETE exactly to confirm. Nothing was removed.",
    };
  }

  const students = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true },
  });

  if (students.length === 0) {
    return { status: "success", message: "There were no participant accounts to delete." };
  }

  const ids = students.map((row) => row.id);
  const registrations = await prisma.registration.count({
    where: { userId: { in: ids } },
  });

  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  await writeAudit({
    action: AUDIT_ACTIONS.allParticipantsDeleted,
    adminId: admin.id,
    targetType: "User",
    metadata: { accountsDeleted: ids.length, registrationsRemoved: registrations },
  });

  revalidatePath("/admin/controls");
  revalidatePath("/admin/participants");
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: `Deleted ${ids.length} participant account${
      ids.length === 1 ? "" : "s"
    } and ${registrations} registration${registrations === 1 ? "" : "s"}. Organiser accounts were kept.`,
  };
}
