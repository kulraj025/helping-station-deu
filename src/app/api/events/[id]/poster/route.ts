import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { resolveEvent } from "@/server/services/event-service";
import { posterSvg } from "@/lib/qr";
import { writeAudit, AUDIT_ACTIONS } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import { formatEventDate, formatTimeRange } from "@/lib/format";

/**
 * Printable A4 poster as SVG.
 *
 * Self-contained: the QR is embedded as a data URL, so the file can be printed
 * without a network connection and cannot be edited to point somewhere else.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await requireAdmin(`/admin/events/${id}`);
  const event = await resolveEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const svg = await posterSvg({
    eventName: event.name,
    tagline: event.tagline ?? "Social & Environmental Awareness & Volunteer Action Program",
    eventSlug: event.slug,
    dateLabel: formatEventDate(event.startAt),
    timeLabel: formatTimeRange(event.startAt, event.endAt),
    locationLabel: event.locationAddress
      ? `${event.locationName}, ${event.locationAddress}`
      : event.locationName,
    deadlineLabel: formatEventDate(event.registrationDeadline),
    contactLabel: event.organizerContact ?? "helpingstation@deu.ac.kr",
  });

  await writeAudit({
    action: AUDIT_ACTIONS.posterDownloaded,
    eventId: event.id,
    adminId: admin.id,
    targetType: "Event",
    targetId: event.id,
    metadata: { slug: event.slug },
    ipHash: await getClientIpHash(),
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-poster.svg"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
