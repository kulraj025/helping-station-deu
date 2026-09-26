import { NextResponse } from "next/server";
import { getPrimaryEvent, getPublicStats, isRegistrationOpen, toPublicEvent } from "@/server/services/event-service";
import { env } from "@/lib/env";

/**
 * Public event metadata.
 *
 * Handy for a noticeboard, a kiosk, or a third-party display that wants the
 * date and registration status without scraping HTML. Contains no personal data.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const event = await getPrimaryEvent();
  if (!event) {
    return NextResponse.json(
      { error: "No public event.", demoMode: env.demoMode },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const stats = await getPublicStats(event.id);

  return NextResponse.json(
    {
      event: toPublicEvent(event),
      registrationOpen: isRegistrationOpen(event),
      participants: stats.totalParticipants,
      demoMode: env.demoMode,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
