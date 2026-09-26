import type { Metadata } from "next";
import { getPrimaryEvent, resolveEvent } from "@/server/services/event-service";
import { getPublicDrawState } from "@/server/services/draw-service";
import { DrawStage } from "@/components/public/draw-stage";
import { Reveal } from "@/components/ui/reveal";
import Link from "next/link";
import { AlertTriangle, Lock, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Lucky draw — live",
  description:
    "Watch the Helping Station DEU lucky draw live, and see afterwards exactly how the winners were selected.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function DrawPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.event === "string" ? params.event : undefined;
  const event = requested ? await resolveEvent(requested) : await getPrimaryEvent();

  if (!event) {
    return (
      <section className="container-page py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold text-leaf-950">No draw to show</h1>
        <p className="mt-2 text-slate-600">There is no public event with a draw right now.</p>
      </section>
    );
  }

  const state = await getPublicDrawState(event.id);
  const hidden = state && !state.visibility.drawScreen && state.status !== "COMPLETED";

  return (
    <section className="bg-canopy relative overflow-hidden py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-30" aria-hidden="true" />
      <div className="container-page relative">
        {hidden ? (
          <div className="mx-auto mb-8 max-w-2xl rounded-3xl border-2 border-amber-300 bg-amber-50 p-7 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="mt-3 font-display text-2xl font-extrabold text-amber-900">
              The draw screen is not public for this event
            </h1>
            <p className="mx-auto mt-2 max-w-md text-amber-800">
              The organiser has not opened the live draw to the public. Results will be published on
              the winners page when the draw is finished.
            </p>
            <Link
              href="/winners"
              className="mt-5 inline-flex h-11 items-center rounded-full bg-amber-500 px-6 font-semibold text-white transition hover:bg-amber-600"
            >
              Go to the winners page
            </Link>
          </div>
        ) : (
          <>
            <Reveal from="up" className="mx-auto mb-8 max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Live &amp; verifiable
              </p>
              <h1 className="mt-4 font-display text-3xl font-extrabold text-leaf-950 sm:text-4xl">
                The lucky draw
              </h1>
              <p className="mt-3 text-lg text-slate-600">
                This page updates by itself. The winner is decided on the server before anything
                appears here — the animation only reveals a result that already exists.
              </p>
            </Reveal>

            <Reveal from="up" delay={100}>
              <DrawStage initialState={state} />
            </Reveal>

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-leaf-950">
                  <Lock className="h-5 w-5 text-leaf-600" aria-hidden="true" />
                  The pool is frozen first
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  When the organiser locks the pool, every eligible entry number is written to an
                  immutable snapshot and hashed. No one can be added or removed after that point, not
                  even by the organiser.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-leaf-950">
                  <ShieldCheck className="h-5 w-5 text-leaf-600" aria-hidden="true" />
                  The randomness is checkable
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The server commits to a hash of the randomness <em>before</em> selecting anybody,
                  then reveals the seed once the draw finishes. That makes it impossible to have
                  chosen the seed after seeing the outcome.
                </p>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-slate-500">
              Full rules on{" "}
              <Link href="/rules" className="font-semibold text-leaf-700 underline underline-offset-2">
                the draw rules page
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </section>
  );
}
