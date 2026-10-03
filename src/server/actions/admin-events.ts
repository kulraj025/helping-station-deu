"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { eventSchema, prizeSchema, type EventInput } from "@/lib/validation";
import { eventSettingsSchema, parseEventSettings, type EventSettings } from "@/lib/event-settings";
import { isEventStatus } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { dateTimeLocalToIso } from "@/lib/datetime";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import { withEvent } from "@/server/admin/scope";
import type { AdminActionState } from "@/lib/action-state";
import { revalidateDrawCaches } from "./revalidate-draw";

/**
 * Event + prize administration.
 *
 * Everything here is audited. Nothing can be undone silently: closing an event,
 * moving the deadline or removing a prize are all recorded with before/after
 * values, and a locked draw pool makes the relevant fields read-only.
 */

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

/** The settings half of `eventSchema`, stored as validated JSON. */
const SETTINGS_KEYS = [
  "requireParticipationForEligibility",
  "allowMultipleWinsPerParticipant",
  "winnerDisplayMode",
  "publicWinnersVisible",
  "publicDrawScreenVisible",
  "showParticipantCount",
  "claimWindowDays",
  "requireDrawConsent",
  "requireEmergencyContact",
  "prizeClaimNote",
  "winnerContactMethod",
  "complianceNote",
] as const;

function settingsFrom(parsed: EventInput): EventSettings {
  const raw: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) {
    const value = (parsed as unknown as Record<string, unknown>)[key];
    if (value !== undefined) raw[key] = value;
  }
  // Defaults fill anything the schema left at `undefined`.
  return eventSettingsSchema.parse({ ...eventSettingsSchema.parse({}), ...raw });
}

/** Read a checkbox group out of FormData. */
const bool = (formData: FormData, key: string) => formData.get(key) === "on";
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/**
 * `datetime-local` values arrive without a timezone, so they are read as the
 * server's wall clock — the same interpretation `toDateTimeLocalValue` writes
 * them back with, which is what makes the round-trip lossless.
 */
function toIso(value: string): string {
  return dateTimeLocalToIso(value);
}

function collectEventForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    tagline: text(formData, "tagline"),
    description: text(formData, "description"),
    locationName: text(formData, "locationName"),
    locationAddress: text(formData, "locationAddress"),
    startAt: toIso(text(formData, "startAt")),
    endAt: toIso(text(formData, "endAt")),
    registrationDeadline: toIso(text(formData, "registrationDeadline")),
    capacity: text(formData, "capacity"),
    organizerName: text(formData, "organizerName"),
    organizerDepartment: text(formData, "organizerDepartment"),
    organizerContact: text(formData, "organizerContact"),
    status: text(formData, "status") || "DRAFT",
    requireParticipationForEligibility: bool(formData, "requireParticipationForEligibility"),
    allowMultipleWinsPerParticipant: bool(formData, "allowMultipleWinsPerParticipant"),
    winnerDisplayMode: text(formData, "winnerDisplayMode") || "MASKED",
    publicWinnersVisible: bool(formData, "publicWinnersVisible"),
    publicDrawScreenVisible: bool(formData, "publicDrawScreenVisible"),
    showParticipantCount: bool(formData, "showParticipantCount"),
    claimWindowDays: text(formData, "claimWindowDays") || "14",
    requireDrawConsent: bool(formData, "requireDrawConsent"),
    requireEmergencyContact: bool(formData, "requireEmergencyContact"),
    prizeClaimNote: text(formData, "prizeClaimNote"),
    winnerContactMethod: text(formData, "winnerContactMethod"),
    complianceNote: text(formData, "complianceNote"),
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function createEventAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin("/admin/events");

  const raw = collectEventForm(formData);
  const parsed = eventSchema.safeParse({
    ...raw,
    status: isEventStatus(raw.status) ? raw.status : "DRAFT",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const data = parsed.data;

  // Unique slug: append a counter rather than failing the whole form.
  const base = slugify(data.name);
  let slug = base;
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const clash = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    slug = `${base}-${attempt + 1}`;
  }

  const event = await prisma.event.create({
    data: {
      name: data.name,
      slug,
      tagline: data.tagline || null,
      description: data.description,
      locationName: data.locationName,
      locationAddress: data.locationAddress || null,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      registrationDeadline: new Date(data.registrationDeadline),
      capacity: data.capacity,
      organizerName: data.organizerName,
      organizerDepartment: data.organizerDepartment || null,
      organizerContact: data.organizerContact || null,
      status: data.status,
      settings: settingsFrom(data) as unknown as object,
      isDemo: bool(formData, "isDemo"),
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.eventCreated,
    eventId: event.id,
    adminId: admin.id,
    targetType: "Event",
    targetId: event.id,
    metadata: { name: event.name, slug: event.slug, status: event.status },
    ipHash: await getClientIpHash(),
  });

  revalidatePath("/admin/events");
  revalidateDrawCaches(event.id);
  return { status: "success", message: `Created “${event.name}”.`, createdId: event.id };
}

export async function updateEventAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const eventId = text(formData, "eventId");
  const admin = await requireAdmin(withEvent(`/admin/events/${eventId}`, eventId));
  if (!eventId) return { status: "error", message: "Missing event." };

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return { status: "error", message: "Event not found." };

  const raw = collectEventForm(formData);
  const parsed = eventSchema.safeParse({
    ...raw,
    status: isEventStatus(raw.status) ? raw.status : existing.status,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const settings = settingsFrom(data);

  // A locked pool must stay consistent with the event definition.
  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    select: { poolLockedAt: true },
  });
  if (draw?.poolLockedAt) {
    if (new Date(data.registrationDeadline).getTime() !== existing.registrationDeadline.getTime()) {
      return {
        status: "error",
        message:
          "The registration deadline cannot change after the pool is locked, because the frozen participant list is tied to it.",
      };
    }
    const oldSettings = parseEventSettings(existing.settings);
    const lockedSettings: Array<keyof EventSettings> = [
      "requireParticipationForEligibility",
      "allowMultipleWinsPerParticipant",
      "requireDrawConsent",
    ];
    const conflict = lockedSettings.find((key) => oldSettings[key] !== settings[key]);
    if (conflict) {
      return {
        status: "error",
        message: `“${conflict}” cannot change after the pool is locked — it would contradict the frozen draw definition.`,
      };
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      name: data.name,
      tagline: data.tagline || null,
      description: data.description,
      locationName: data.locationName,
      locationAddress: data.locationAddress || null,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      registrationDeadline: new Date(data.registrationDeadline),
      capacity: data.capacity,
      organizerName: data.organizerName,
      organizerDepartment: data.organizerDepartment || null,
      organizerContact: data.organizerContact || null,
      status: data.status,
      settings: settings as unknown as object,
    },
  });

  // Record only what actually changed, so the audit log stays readable.
  const changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }> = {};
  for (const key of [
    "name",
    "tagline",
    "locationName",
    "startAt",
    "endAt",
    "registrationDeadline",
    "capacity",
    "status",
  ] as const) {
    const before = existing[key] as Date | string | number | null;
    const after = updated[key] as Date | string | number | null;
    if (String(before) !== String(after)) {
      changes[key] = {
        from: before instanceof Date ? before.toISOString() : before,
        to: after instanceof Date ? after.toISOString() : after,
      };
    }
  }
  const oldSettings = parseEventSettings(existing.settings);
  for (const key of SETTINGS_KEYS) {
    if (oldSettings[key] !== settings[key]) {
      changes[`settings.${key}`] = {
        from: oldSettings[key] as string | boolean | number,
        to: settings[key] as string | boolean | number,
      };
    }
  }

  await writeAudit({
    action: AUDIT_ACTIONS.eventUpdated,
    eventId,
    adminId: admin.id,
    targetType: "Event",
    targetId: eventId,
    metadata: { changes },
    ipHash: await getClientIpHash(),
  });

  revalidatePath("/admin/events");
  revalidatePath(withEvent(`/admin/events/${eventId}`, eventId));
  revalidateDrawCaches(eventId);
  return { status: "success", message: "Event updated." };
}

/** Lifecycle transition, with the rules the UI only hints at. */
export async function setEventStatusAction(formData: FormData): Promise<void> {
  const eventId = text(formData, "eventId");
  const statusRaw = text(formData, "status");
  const admin = await requireAdmin(withEvent("/admin/events", eventId));

  if (!isEventStatus(statusRaw)) redirect(withEvent("/admin/events?error=bad-status", eventId));

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) redirect(withEvent("/admin/events?error=not-found", eventId));

  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    select: { status: true },
  });

  // A completed draw implies a completed event; never let them disagree.
  if (draw?.status === "COMPLETED" && statusRaw !== "COMPLETED" && statusRaw !== "ARCHIVED") {
    redirect(withEvent("/admin/events?error=draw-complete", eventId));
  }
  if (statusRaw === "PUBLISHED" && event.registrationDeadline.getTime() < Date.now()) {
    redirect(withEvent("/admin/events?error=past-deadline", eventId));
  }
  if (statusRaw === event.status) {
    redirect(withEvent(`/admin/events/${eventId}?saved=status`, eventId));
  }

  await prisma.event.update({ where: { id: eventId }, data: { status: statusRaw } });
  await writeAudit({
    action: AUDIT_ACTIONS.eventStatusChanged,
    eventId,
    adminId: admin.id,
    targetType: "Event",
    targetId: eventId,
    metadata: { from: event.status, to: statusRaw },
    ipHash: await getClientIpHash(),
  });

  revalidatePath("/admin/events");
  revalidatePath(withEvent(`/admin/events/${eventId}`, eventId));
  revalidateDrawCaches(eventId);
  redirect(withEvent(`/admin/events/${eventId}?saved=status`, eventId));
}

// ---------------------------------------------------------------------------
// Prizes
// ---------------------------------------------------------------------------

function prizePayload(formData: FormData) {
  return {
    eventId: text(formData, "eventId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    quantity: text(formData, "quantity"),
    claimInstructions: text(formData, "claimInstructions"),
  };
}

export async function createPrizeAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const eventId = text(formData, "eventId");
  const admin = await requireAdmin(withEvent("/admin/prizes", eventId));
  if (!eventId) return { status: "error", message: "Missing event." };

  const parsed = prizeSchema.safeParse(prizePayload(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const locked = await poolLockedMessage(eventId);
  if (locked) return { status: "error", message: locked };

  // Next free order — `order` is unique per event.
  const maxOrder = await prisma.prize.aggregate({
    where: { eventId },
    _max: { order: true },
  });
  let order = (maxOrder._max.order ?? 0) + 1;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const clash = await prisma.prize.findFirst({ where: { eventId, order }, select: { id: true } });
    if (!clash) break;
    order += 1;
  }

  const prize = await prisma.prize.create({
    data: {
      eventId,
      name: data.name,
      description: data.description || null,
      quantity: data.quantity,
      order,
      claimInstructions: data.claimInstructions || null,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.prizesConfigured,
    eventId,
    adminId: admin.id,
    targetType: "Prize",
    targetId: prize.id,
    metadata: { name: prize.name, quantity: prize.quantity, order: prize.order },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/prizes", eventId));
  revalidatePath(withEvent(`/admin/events/${eventId}`, eventId));
  revalidateDrawCaches(eventId);
  return { status: "success", message: `Added prize “${prize.name}”.` };
}

export async function updatePrizeAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const prizeId = text(formData, "prizeId");
  const admin = await requireAdmin("/admin/prizes");

  const existing = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!existing) return { status: "error", message: "Prize not found." };
  const eventId = existing.eventId;

  const parsed = prizeSchema.safeParse({ ...prizePayload(formData), eventId });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const locked = await poolLockedMessage(eventId);
  if (locked) return { status: "error", message: locked };

  const prize = await prisma.prize.update({
    where: { id: prizeId },
    data: {
      name: data.name,
      description: data.description || null,
      quantity: data.quantity,
      claimInstructions: data.claimInstructions || null,
    },
  });

  const changes: Record<string, { from: string | number | null; to: string | number | null }> = {};
  for (const key of ["name", "description", "quantity", "claimInstructions"] as const) {
    const before = existing[key] as string | number | null;
    const after = prize[key] as string | number | null;
    if (String(before) !== String(after)) {
      changes[key] = { from: before, to: after };
    }
  }

  await writeAudit({
    action: AUDIT_ACTIONS.prizeUpdated,
    eventId,
    adminId: admin.id,
    targetType: "Prize",
    targetId: prizeId,
    metadata: { changes },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/prizes", eventId));
  revalidatePath(withEvent(`/admin/events/${eventId}`, eventId));
  revalidateDrawCaches(eventId);
  return { status: "success", message: "Prize updated." };
}

export async function deletePrizeAction(formData: FormData): Promise<void> {
  const prizeId = text(formData, "prizeId");
  const admin = await requireAdmin("/admin/prizes");

  const prize = await prisma.prize.findUnique({ where: { id: prizeId } });
  if (!prize) redirect("/admin/prizes?error=not-found");
  const eventId = prize.eventId;

  if (await poolLockedMessage(eventId)) {
    redirect(withEvent("/admin/prizes?error=locked", eventId));
  }
  const winnerCount = await prisma.winner.count({ where: { prizeId } });
  if (winnerCount > 0) {
    redirect(withEvent("/admin/prizes?error=has-winners", eventId));
  }

  await prisma.prize.delete({ where: { id: prizeId } });
  await writeAudit({
    action: AUDIT_ACTIONS.prizeDeleted,
    eventId,
    adminId: admin.id,
    targetType: "Prize",
    targetId: prizeId,
    metadata: { name: prize.name, quantity: prize.quantity, order: prize.order },
    ipHash: await getClientIpHash(),
  });

  revalidatePath(withEvent("/admin/prizes", eventId));
  revalidatePath(withEvent(`/admin/events/${eventId}`, eventId));
  revalidateDrawCaches(eventId);
  redirect(withEvent("/admin/prizes?saved=deleted", eventId));
}

/** Shared guard: prize definitions are frozen once the pool is locked. */
async function poolLockedMessage(eventId: string): Promise<string | null> {
  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId, official: true } },
    select: { poolLockedAt: true },
  });
  if (!draw?.poolLockedAt) return null;
  return "Prizes are frozen once the participant pool is locked, because the number of prize slots is part of the draw definition. Revoking a prize is recorded as a correction instead.";
}
