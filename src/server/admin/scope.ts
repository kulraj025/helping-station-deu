import "server-only";
import { prisma } from "@/lib/prisma";
import { getPrimaryEvent, resolveEvent, type EventWithSettings } from "@/server/services/event-service";
import type { CurrentUser } from "@/lib/auth-helpers";
import { isEventStatus, type EventStatus } from "@/lib/constants";
import { parseEventSettings, type EventSettings } from "@/lib/event-settings";

/**
 * Admin event scope.
 *
 * Every admin page operates on exactly one event, chosen by `?event=`. The
 * default is the newest published/completed event, so a reviewer who just logs
 * in lands on something meaningful instead of an empty page.
 */

export interface AdminEvent extends EventWithSettings {
  settings: EventSettings;
}

export interface AdminScope {
  admin: CurrentUser;
  event: AdminEvent | null;
  /** Every event the admin can switch between, newest first. */
  events: Array<{ id: string; name: string; slug: string; status: string; startAt: Date; isDemo: boolean }>;
  requestedId: string | null;
  /** True when the organiser asked for an event that does not exist. */
  notFound: boolean;
}

/**
 * Anything a page might hand us for its query string.
 *
 * Next 15 hands a page its `searchParams` as a promise, but it is genuinely
 * absent in some render paths (error boundaries, a page reached through a
 * parallel route, a hot reload that re-invokes the function without props).
 * Accepting the promise *or* the value *or* nothing means a missing query
 * string degrades to "no event requested" instead of throwing a
 * `Cannot read properties of undefined` on every admin page.
 */
export type AdminSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | null
  | undefined;

export async function getAdminScope(
  searchParams: AdminSearchParams,
  admin: CurrentUser,
): Promise<AdminScope> {
  // `await` on a plain object is a no-op, so this handles both call styles.
  const query = (await searchParams) ?? {};
  const raw = query.event;
  const requested = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  const rows = await prisma.event.findMany({
    orderBy: [{ startAt: "desc" }],
    select: { id: true, name: true, slug: true, status: true, startAt: true, isDemo: true },
  });

  let event: AdminEvent | null = null;
  if (requested) {
    event = await resolveEvent(requested);
  } else {
    const primary = await getPrimaryEvent();
    event = primary ?? (rows[0] ? await resolveEvent(rows[0].id) : null);
  }

  if (event) {
    // Re-read through the settings parser so the admin always gets validated JSON.
    const row = await prisma.event.findUnique({ where: { id: event.id } });
    if (row) {
      event = { ...(row as Omit<AdminEvent, "settings">), settings: parseEventSettings(row.settings) } as AdminEvent;
    }
  }

  return {
    admin,
    event,
    events: rows,
    requestedId: requested,
    notFound: requested !== null && event === null,
  };
}

/** Statuses an organiser may set, in the order they should progress. */
export const EVENT_STATUS_FLOW: EventStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
];

export function isKnownEventStatus(value: string): value is EventStatus {
  return isEventStatus(value);
}

/** Appends `event` to a path so admin links keep the current scope. */
export function withEvent(path: string, eventId: string | null | undefined): string {
  if (!eventId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}event=${encodeURIComponent(eventId)}`;
}
