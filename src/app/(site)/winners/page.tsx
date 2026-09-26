import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Fingerprint, MapPin, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPublicWinnersForEvent } from "@/server/services/winner-service";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Reveal } from "@/components/ui/reveal";
import { formatDateTime, formatEventDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Winners",
  description:
    "Lucky draw results for Helping Station DEU, with the fingerprints needed to verify how each winner was selected.",
};

export const dynamic = "force-dynamic";

export default async function WinnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.event === "string" ? params.event : undefined;

  // Either a specific event, or every completed event that publishes winners.
  const events = requested
    ? await prisma.event.findMany({ where: { id: requested }, take: 1 })
    : await prisma.event.findMany({
        where: { status: { in: ["COMPLETED", "ARCHIVED"] } },
        orderBy: { startAt: "desc" },
      });

  const groups = (await Promise.all(events.map((event) => getPublicWinnersForEvent(event.id)))).filter(
    (group): group is NonNullable<typeof group> => group !== null,
  );

  const publishedCount = groups.reduce((sum, group) => sum + group.winners.length, 0);

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-30" aria-hidden="true" />
      <div className="container-page relative">
        <Reveal from="up" className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold-300/50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-gold-600">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Results
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold text-leaf-950 sm:text-5xl">
            Lucky draw winners
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            {publishedCount > 0
              ? `${publishedCount} prize${publishedCount === 1 ? "" : "s"} have been drawn. Names are masked, and only for participants who chose to be listed.`
              : "No draw results have been published yet."}
          </p>
        </Reveal>

        {groups.length === 0 ? (
          <div className="mx-auto mt-12 max-w-xl">
            <EmptyState
              icon="🎁"
              title="No published winners yet"
              description="The first edition's draw has not happened yet. Check back after the event, or watch the draw live."
              action={
                <ButtonLink href="/draw" variant="gold">
                  Go to the live draw
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <div className="mt-12 space-y-10">
            {groups.map((group, groupIndex) => (
              <Reveal key={group.drawId} from="up" delay={groupIndex * 80}>
                <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
                  <header className="border-b border-slate-200 bg-leaf-50/60 px-6 py-5 sm:px-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-leaf-950">
                          {group.eventName}
                        </h2>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-leaf-600" aria-hidden="true" />
                            {formatEventDate(group.eventDate)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-gold-500" aria-hidden="true" />
                            {group.locationName}
                          </span>
                        </p>
                      </div>
                      {group.completedAt ? (
                        <Badge tone="leaf" dot>
                          Drawn {formatDateTime(group.completedAt)}
                        </Badge>
                      ) : null}
                    </div>
                  </header>

                  <div className="p-6 sm:p-8">
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {group.winners.map((winner, index) => (
                        <li
                          key={winner.id}
                          className="group relative overflow-hidden rounded-2xl border border-gold-200 bg-gradient-to-br from-amber-50 to-white p-5 transition hover:border-gold-400 hover:shadow-lift"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-gold-600">
                                Prize {winner.prizeOrder} · {winner.prizeQuantity} available
                              </p>
                              <h3 className="mt-1.5 font-display text-lg font-extrabold text-leaf-950">
                                {winner.prizeName}
                              </h3>
                              <p className="mt-2 font-mono text-sm font-bold text-leaf-800">
                                {winner.entryNumber}
                              </p>
                              {winner.displayName ? (
                                <p className="mt-1 text-sm text-slate-600">
                                  {winner.displayName}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-slate-400">
                                  Name withheld at the participant&apos;s request
                                </p>
                              )}
                            </div>
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-300/60 text-xl"
                              aria-hidden="true"
                            >
                              {index + 1 <= 3 ? ["🥇", "🥈", "🥉"][index] : "🎁"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-6 flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                      <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
                      <span>
                        Entry numbers are the only reliable identifier here — a masked name may be
                        shared by two people. To claim a prize, bring your entry number and student ID
                        to the organiser&apos;s desk.
                      </span>
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}

            <Reveal from="up" className="mx-auto max-w-3xl rounded-3xl border border-leaf-200 bg-white p-7 text-center shadow-soft">
              <h2 className="flex items-center justify-center gap-2 font-display text-xl font-extrabold text-leaf-950">
                <ShieldCheck className="h-5 w-5 text-leaf-600" aria-hidden="true" />
                Can I verify this?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Yes. The participant-list fingerprint and the randomness fingerprint are published
                with each draw. Re-running the published algorithm over the published entry numbers
                reproduces the same winners — the organiser cannot quietly change the result after
                the fact.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/draw" variant="secondary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Watch the draw live
                </ButtonLink>
                <ButtonLink href="/rules" variant="ghost">
                  Read the full rules
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        )}

        <p className="mt-10 text-center text-sm text-slate-500">
          Think a result is wrong?{" "}
          <Link href="/rules#corrections" className="font-semibold text-leaf-700 underline underline-offset-2">
            Corrections are appended, never overwritten
          </Link>{" "}
          — see how they are recorded.
        </p>
      </div>
    </section>
  );
}
