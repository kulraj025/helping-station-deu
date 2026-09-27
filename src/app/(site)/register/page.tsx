import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, Info } from "lucide-react";
import { getPrimaryEvent, isRegistrationOpen, resolveEvent } from "@/server/services/event-service";
import { EventSummaryCard, RegistrationForm } from "@/components/public/register-form";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { env } from "@/lib/env";
import { getSiteSettings } from "@/server/services/site-settings-service";
import { SectionClosed } from "@/components/site/section-closed";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Register for Helping Station DEU. It takes about a minute, and you get an entry number straight away.",
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.event === "string" ? params.event : undefined;

  // Checked before anything else so a closed registration page costs one query
  // and never touches the event.
  const site = await getSiteSettings();
  if (!site.siteOpen || !site.registerOpen) {
    return <SectionClosed sectionLabel="Registration" note={site.closedNote} />;
  }

  const event = requested ? await resolveEvent(requested) : await getPrimaryEvent();

  if (!event) {
    return (
      <section className="container-page py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
          <CalendarX2 className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-leaf-950">
            No event is open for registration
          </h1>
          <p className="mt-2 text-slate-600">
            There is no published event right now. Check back soon, or look at what previous
            editions involved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/event">About the programme</ButtonLink>
            <ButtonLink href="/winners" variant="secondary">
              Past winners
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  const open = isRegistrationOpen(event);

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
      <div className="container-page relative">
        <Reveal from="up">
          <h1 className="font-display text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            Register for the event
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-600">
            It takes about a minute. You will get an entry number immediately — bring it with you on
            the day.
          </p>
        </Reveal>

        {env.demoMode ? (
          <Reveal from="up" delay={60} className="mt-4">
            <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-extrabold">Demo mode.</strong> Registrations you make here
                are stored with fictional data and are clearly marked. Nothing is sent to a real
                student.
              </span>
            </p>
          </Reveal>
        ) : null}

        {!open ? (
          <div className="mt-8 rounded-3xl border-2 border-gold-300 bg-amber-50 p-8 text-center">
            <CalendarX2 className="mx-auto h-11 w-11 text-amber-500" aria-hidden="true" />
            <h2 className="mt-3 font-display text-2xl font-extrabold text-amber-900">
              Registration is closed
            </h2>
            <p className="mx-auto mt-2 max-w-md text-amber-800">
              {event.name} is no longer accepting registrations
              {event.status === "COMPLETED" ? " — the event has already taken place." : "."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/winners" variant="gold">
                See who won
              </ButtonLink>
              <ButtonLink href="/event" variant="secondary">
                About the programme
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
            <Reveal from="up" delay={80} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
              <RegistrationForm
                event={{
                  id: event.id,
                  name: event.name,
                  slug: event.slug,
                  startAt: event.startAt.toISOString(),
                  endAt: event.endAt.toISOString(),
                  locationName: event.locationName,
                  registrationDeadline: event.registrationDeadline.toISOString(),
                  requireEmergencyContact: event.settings.requireEmergencyContact,
                  settings: {
                    complianceNote: event.settings.complianceNote,
                    prizeClaimNote: event.settings.prizeClaimNote,
                  },
                }}
              />
            </Reveal>
            <Reveal from="right" delay={160}>
              <EventSummaryCard
                event={{
                  id: event.id,
                  name: event.name,
                  slug: event.slug,
                  startAt: event.startAt.toISOString(),
                  endAt: event.endAt.toISOString(),
                  locationName: event.locationName,
                  registrationDeadline: event.registrationDeadline.toISOString(),
                  requireEmergencyContact: event.settings.requireEmergencyContact,
                  settings: {
                    complianceNote: event.settings.complianceNote,
                    prizeClaimNote: event.settings.prizeClaimNote,
                  },
                }}
              />
              <p className="mt-4 px-2 text-xs leading-relaxed text-slate-500">
                Trouble with the form?{" "}
                <Link href="/rules#faq" className="font-semibold text-leaf-700 underline underline-offset-2">
                  Read the FAQ
                </Link>{" "}
                or e-mail the organiser.
              </p>
            </Reveal>
          </div>
        )}
      </div>
    </section>
  );
}
