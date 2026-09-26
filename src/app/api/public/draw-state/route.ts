import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicDrawState } from "@/server/services/draw-service";
import { getEventById, resolveEvent } from "@/server/services/event-service";
import { isSameOrigin } from "@/lib/http";

/**
 * Public draw state for the live draw screen.
 *
 * Returns only what the projector needs: counts, statuses, entry numbers, masked
 * names and the integrity fingerprints. No e-mails, phone numbers, student IDs
 * or full names — those never cross this boundary.
 */

export const dynamic = "force-dynamic";

const querySchema = z.object({ event: z.string().min(1).max(64) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ event: url.searchParams.get("event") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing event parameter." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const event = (await resolveEvent(parsed.data.event)) ?? null;
  const eventId = event?.id ?? (await getEventById(parsed.data.event))?.id;
  if (!eventId) {
    return NextResponse.json({ error: "Event not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const state = await getPublicDrawState(eventId);
  if (!state) {
    return NextResponse.json({ error: "Event not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  // An organiser can hide the draw screen for a particular event.
  if (!state.visibility.drawScreen && state.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "The draw screen is not public for this event." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Same-origin guard for any future state-changing use of this endpoint. */
export async function POST() {
  if (!(await isSameOrigin())) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  return NextResponse.json({ error: "Use GET." }, { status: 405 });
}
