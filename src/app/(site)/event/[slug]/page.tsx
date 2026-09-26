import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Info,
  Mail,
  MapPin,
  Shuffle,
  Ticket,
  Users,
} from "lucide-react";
import { resolveEvent, isPubliclyVisible, isRegistrationOpen } from "@/server/services/event-service";
import { getPublicStats } from "@/server/services/event-service";
import { getPublicWinnersForEvent } from "@/server/services/winner-service";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EventStatusBadge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { formatEventDate, formatRelativeDeadline, formatTimeRange } from "@/lib/format";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Per-event page. The slug is permanent, so an old poster link keeps working. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await resolveEvent(slug);
  if (!event || !isPubliclyVisible(event)) {
    return { title: "Event not found", robots: { index: false, follow: false } };
  }

  return {
    title: event.name,
    description: event.tagline ?? event.description.slice(0, 155),
    alternates: { canonical: `/event/${event.slug}` },
    openGraph: {
      title: event.name,
      description: event.tagline ?? event.description.slice(0, 155),
      type: "article",
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await resolveEvent(slug);

  // A draft is a 404, not a "coming soon" page: unpublished work should not be
  // discoverable by guessing a URL.
  if (!event || !isPubliclyVisible(event)) notFound();

  const open = isRegistrationOpen(event);
  const [stats, winnerGroup] = await Promise.all([
    getPublicStats(event.id),
    getPublicWinnersForEvent(event.id),
  ]);

  return (
    <>
      <section className="bg-canopy relative overflow-hidden py-14 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-grid-lines opacity-50"
          aria-hidden="true"
        />
        <div className="container-page relative">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm">
            <Link href="/" className="text-slate-600 hover:text-leaf-700">
              Home
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden="true">
              /
            </span>
            <Link href="/event" className="text-slate-600 hover:text-leaf-700">
              The programme
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-leaf-800">{event.name}</span>
          </nav>

          <Reveal from="up">
            <div className="flex flex-wrap items-center gap-2.5">
              <EventStatusBadge status={event.status} />
              {event.isDemo ? <Badge tone="gold">Demo data</Badge> : null}
              {open ? (
                <Badge tone="leaf" dot>
                  Registration open
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-leaf-950 sm:text-4xl lg:text-5xl">
              {event.name}
            </h1>
            {event.tagline ? (
              <p className="mt-3 max-w-2xl text-lg font-semibold text-leaf-700">{event.tagline}</p>
            ) : null}
            <p className="mt-5 max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-slate-700">
              {event.description}
            </p>
          </Reveal>

          <Reveal from="up" delay={120} className="mt-8">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: CalendarDays, tone: "text-leaf-600", term: "Date", body: formatEventDate(event.startAt) },
                {
                  icon: Clock,
                  tone: "text-azure-500",
                  term: "Time",
                  body: formatTimeRange(event.startAt, event.endAt),
                },
                {
                  icon: MapPin,
                  tone: "text-gold-500",
                  term: "Where",
                  body: event.locationName,
                  extra: event.locationAddress,
                },
                {
                  icon: Info,
                  tone: "text-leaf-600",
                  term: "Registration",
                  body: open
                    ? `Closes ${formatRelativeDeadline(event.registrationDeadline)}`
                    : "Closed",
                },
              ].map((item) => (
                <div
                  key={item.term}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
                >
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <item.icon className={`h-4 w-4 ${item.tone}`} aria-hidden="true" />
                    {item.term}
                  </dt>
                  <dd className="mt-2 font-bold text-leaf-950">{item.body}</dd>
                  {item.extra ? <dd className="mt-1 text-sm text-slate-500">{item.extra}</dd> : null}
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal from="up" delay={200} className="mt-8 flex flex-col gap-3 sm:flex-row">
            {open ? (
              <ButtonLink href={`/register?event=${event.slug}`} size="lg">
                <Ticket className="h-4 w-4" aria-hidden="true" />
                Register — takes a minute
              </ButtonLink>
            ) : (
              <ButtonLink href="/event" variant="secondary" size="lg">
                See the full programme
              </ButtonLink>
            )}
            <ButtonLink href="/rules" variant="secondary" size="lg">
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              How the draw works
            </ButtonLink>
          </Reveal>

          {env.demoMode ? (
            <p className="mt-6 max-w-2xl rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
              <strong className="font-extrabold">Demo mode.</strong> Everything on this page is
              fictional test data used to demonstrate the software.
            </p>
          ) : null}
        </div>
      </section>

      {/* what participation involves */}
      <section className="bg-white py-14 sm:py-16">
        <div className="container-page grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Reveal from="left">
            <h2 className="font-display text-2xl font-extrabold text-leaf-950">
              Who can take part
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700">
              <p>
                Any Dong-Eui University student can register. No experience is needed — every activity
                team has a coordinator who walks new volunteers through it.
              </p>
              <p>
                Registration is free, and so is lunch. Prizes are a token of thanks for taking part,
                not a competition you are expected to prepare for.
              </p>
              {event.capacity ? (
                <p>
                  There are{" "}
                  <strong className="text-leaf-800">
                    {event.capacity} places
                  </strong>{" "}
                  in total for this edition.
                </p>
              ) : null}
            </div>

            {event.settings.prizeClaimNote ? (
              <div className="mt-6 rounded-2xl border border-leaf-200 bg-leaf-50 p-5">
                <h3 className="text-sm font-extrabold text-leaf-900">Collecting a prize</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-leaf-900/90">
                  {event.settings.prizeClaimNote}
                </p>
                {event.settings.winnerContactMethod ? (
                  <p className="mt-2.5 text-xs leading-relaxed text-leaf-800">
                    {event.settings.winnerContactMethod}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Reveal>

          <Reveal from="right" delay={100}>
            <div className="rounded-3xl border border-slate-200 bg-canvas p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-leaf-950">
                <Users className="h-5 w-5 text-leaf-600" aria-hidden="true" />
                This edition so far
              </h2>

              {event.settings.showParticipantCount && stats.totalParticipants !== null ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 pb-2">
                    <dt className="text-slate-600">Registered</dt>
                    <dd className="font-display text-xl font-extrabold text-leaf-950">
                      {stats.totalParticipants}
                    </dd>
                  </div>
                  {event.settings.publicDrawScreenVisible ? (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-slate-600">Confirmed for the draw</dt>
                      <dd className="font-display text-xl font-extrabold text-leaf-950">
                        {stats.eligibleParticipants ?? 0}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  The organiser has chosen not to publish participation numbers for this event.
                </p>
              )}

              <dl className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Organiser
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">
                    {event.organizerName}
                    {event.organizerDepartment ? (
                      <span className="font-normal text-slate-500">
                        {" "}
                        &middot; {event.organizerDepartment}
                      </span>
                    ) : null}
                  </dd>
                </div>
                {event.organizerContact ? (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Questions
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={
                          event.organizerContact.includes("@")
                            ? `mailto:${event.organizerContact}`
                            : `tel:${event.organizerContact}`
                        }
                        className="inline-flex items-center gap-1.5 font-semibold text-leaf-700 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {event.organizerContact}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* winners, if the draw already ran */}
      {winnerGroup && winnerGroup.winners.length > 0 ? (
        <section className="bg-canopy py-14 sm:py-16">
          <div className="container-page">
            <Reveal from="up" className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold text-leaf-950">
                  Winners from this edition
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Entry numbers, and masked names only for those who opted in.
                </p>
              </div>
              <ButtonLink href="/winners" variant="secondary" size="sm">
                All winners
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </Reveal>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {winnerGroup.winners.map((winner) => (
                <li
                  key={winner.id}
                  className="rounded-2xl border border-gold-200 bg-white p-5 shadow-soft"
                >
                  <p className="font-mono text-sm font-extrabold text-leaf-900">
                    {winner.entryNumber}
                  </p>
                  {winner.displayName ? (
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {winner.displayName}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      Name withheld at the participant&apos;s request
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-600">{winner.prizeName}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
