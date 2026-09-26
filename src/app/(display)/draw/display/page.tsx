import { getPrimaryEvent, resolveEvent } from "@/server/services/event-service";
import { getPublicDrawState } from "@/server/services/draw-service";
import { DrawStage } from "@/components/public/draw-stage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Projector view of the draw.
 *
 * Same component as `/draw`, different chrome and larger type. Safe to leave
 * open on a hall screen: it self-updates, and once the draw is finished it stops
 * polling.
 */
export default async function DrawDisplayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.event === "string" ? params.event : undefined;
  const event = requested ? await resolveEvent(requested) : await getPrimaryEvent();

  if (!event) {
    return (
      <p className="text-center font-display text-3xl font-extrabold text-leaf-100">
        No event is configured for the display.
      </p>
    );
  }

  const state = await getPublicDrawState(event.id);
  const hidden = state && !state.visibility.drawScreen && state.status !== "COMPLETED";

  if (hidden) {
    return (
      <div className="text-center">
        <p className="font-display text-4xl font-extrabold text-leaf-100">
          The draw screen is not public for this event.
        </p>
        <p className="mt-4 text-lg text-leaf-200">
          Ask the organiser to open it from the admin area if this screen is needed.
        </p>
        <Link
          href="/admin/draw"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-leaf-600 px-7 font-semibold text-white hover:bg-leaf-500"
        >
          Organiser sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* White surface so the shared stage component keeps its light styling. */}
      <div className="rounded-[2.5rem] bg-canvas p-4 shadow-glow sm:p-8">
        <DrawStage initialState={state} mode="display" />
      </div>
      <p className="mt-6 text-center text-sm text-leaf-200">
        <Link href="/draw" className="inline-flex items-center gap-1.5 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Exit display mode
        </Link>
      </p>
    </>
  );
}
