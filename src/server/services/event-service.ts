import "server-only";
import { prisma } from "@/lib/prisma";
import { parseEventSettings, type EventSettings } from "@/lib/event-settings";
import { isEventStatus, type EventStatus } from "@/lib/constants";
import { env } from "@/lib/env";

/**
 * Event reads shared by public pages, the admin area and the draw screen.
 */

export interface EventWithSettings {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  locationName: string;
  locationAddress: string | null;
  startAt: Date;
  endAt: Date;
  registrationDeadline: Date;
  status: EventStatus;
  capacity: number | null;
  organizerName: string;
  organizerDepartment: string | null;
  organizerContact: string | null;
  isDemo: boolean;
  settings: EventSettings;
  createdAt: Date;
  updatedAt: Date;
}

type EventRow = Omit<EventWithSettings, "settings"> & { settings: unknown };

function withSettings(row: EventRow): EventWithSettings {
  return { ...row, settings: parseEventSettings(row.settings) };
}

export async function getEventById(id: string): Promise<EventWithSettings | null> {
  const row = await prisma.event.findUnique({ where: { id } });
  return row ? withSettings(row as EventRow) : null;
}

export async function getEventBySlug(slug: string): Promise<EventWithSettings | null> {
  const row = await prisma.event.findFirst({ where: { slug } });
  return row ? withSettings(row as EventRow) : null;
}

/** Accepts either an id or a slug — QR codes and deep links use slugs. */
export async function resolveEvent(idOrSlug: string): Promise<EventWithSettings | null> {
  const row = await prisma.event.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  return row ? withSettings(row as EventRow) : null;
}

/** The event shown across the public site. */
export async function getPrimaryEvent(options: { includeDrafts?: boolean } = {}): Promise<EventWithSettings | null> {
  const statuses: EventStatus[] = options.includeDrafts
    ? ["PUBLISHED", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "DRAFT"]
    : ["PUBLISHED", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED"];

  const row = await prisma.event.findFirst({
    where: {
      status: { in: statuses },
      isDemo: env.demoMode ? undefined : false,
    },
    orderBy: [{ isDemo: "desc" }, { startAt: "desc" }],
  });
  return row ? withSettings(row as EventRow) : null;
}

export async function listEvents(options: { includeDrafts?: boolean } = {}): Promise<EventWithSettings[]> {
  const rows = await prisma.event.findMany({
    where: options.includeDrafts ? {} : { status: { not: "DRAFT" } },
    orderBy: [{ startAt: "desc" }],
  });
  return rows.map((row) => withSettings(row as EventRow));
}

export function isRegistrationOpen(event: EventWithSettings, now: Date = new Date()): boolean {
  return (
    event.status === "PUBLISHED" &&
    event.registrationDeadline.getTime() > now.getTime() &&
    now.getTime() <= event.startAt.getTime()
  );
}

export function isPubliclyVisible(event: EventWithSettings): boolean {
  return ["PUBLISHED", "REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED"].includes(event.status);
}

/** Public-safe counts. No personal data crosses this boundary. */
export async function getPublicStats(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { settings: true, status: true },
  });
  const settings = parseEventSettings(event?.settings);

  const [total, eligible] = await Promise.all([
    prisma.registration.count({ where: { eventId, registrationStatus: "CONFIRMED" } }),
    prisma.registration.count({ where: { eventId, drawEligibility: "ELIGIBLE", registrationStatus: "CONFIRMED" } }),
  ]);

  return {
    totalParticipants: settings.showParticipantCount ? total : null,
    eligibleParticipants: settings.showParticipantCount ? eligible : null,
    status: event?.status ?? null,
    settings,
  };
}

export function toPublicEvent(event: EventWithSettings) {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    tagline: event.tagline,
    startAt: event.startAt,
    endAt: event.endAt,
    registrationDeadline: event.registrationDeadline,
    status: event.status,
    capacity: event.capacity,
    locationName: event.locationName,
    organizerName: event.organizerName,
    organizerContact: event.organizerContact,
    isDemo: event.isDemo,
    settings: event.settings,
  };
}

export function eventSlugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || `event-${Date.now()}`
  );
}

export { isEventStatus };
