import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEventById, getPrimaryEvent } from "@/server/services/event-service";
import { ButtonLink } from "@/components/ui/button";
import { PrintButton } from "@/components/public/print-button";
import { Reveal } from "@/components/ui/reveal";
import { formatEventDate, formatTimeRange } from "@/lib/format";
import { registerUrl } from "@/lib/qr";

export const metadata: Metadata = {
  title: "Participation card",
  description: "Your printable participation card for Helping Station DEU.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Printable participant card. */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const entryNumber = typeof params.entry === "string" ? params.entry.trim() : "";
  if (!entryNumber) notFound();

  // Public-safe projection: the entry number only. Never expose the name here —
  // entry numbers are sequential, so a name would leak to anyone who guesses one.
  const registration = await prisma.registration.findFirst({
    where: { entryNumber, registrationStatus: "CONFIRMED" },
    select: {
      entryNumber: true,
      volunteerRole: true,
      createdAt: true,
      isDemo: true,
      eventId: true,
    },
  });

  const event =
    (registration ? await getEventById(registration.eventId) : null) ?? (await getPrimaryEvent());

  if (!registration || !event) {
    return (
      <section className="container-page py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold text-leaf-950">Entry number not found</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          We could not find entry number <span className="font-mono font-bold">{entryNumber}</span>.
          Check for typos, or sign in to your account to see your registration.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/account">Go to my account</ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Register again
          </ButtonLink>
        </div>
      </section>
    );
  }

  const settings = event.settings;
  const url = registerUrl(event.slug);
  const isDemo = registration.isDemo || event.isDemo;

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
      <div className="container-page relative">
        <Reveal from="up" className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-leaf-600" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            You are in!
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-lg text-slate-600">
            Save this card or take a screenshot. Bring the entry number with you on the day.
          </p>
        </Reveal>

        {/* the printable card */}
        <Reveal from="up" delay={120} className="mx-auto mt-10 max-w-2xl">
          <div className="print-card overflow-hidden rounded-3xl border-2 border-leaf-700 bg-white shadow-lift">
            <div className="bg-leaf-700 px-6 py-5 text-white sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-leaf-100">
                Participation card
              </p>
              <p className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{event.name}</p>
            </div>

            <div className="px-6 py-8 text-center sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Your entry number
              </p>
              <p className="mt-3 font-display text-5xl font-extrabold tracking-tight text-leaf-900 sm:text-6xl">
                {registration.entryNumber}
              </p>
              {registration.volunteerRole ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-leaf-100 px-3 py-1 text-xs font-bold text-leaf-800">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {registration.volunteerRole}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 border-t border-slate-200 px-6 py-6 text-sm sm:grid-cols-2 sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Date</p>
                <p className="mt-1 font-semibold text-slate-800">{formatEventDate(event.startAt)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Time</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {formatTimeRange(event.startAt, event.endAt)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Where</p>
                <p className="mt-1 flex items-start gap-1.5 font-semibold text-slate-800">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
                  {event.locationName}
                  {event.locationAddress ? (
                    <span className="font-normal text-slate-500">— {event.locationAddress}</span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-leaf-50/60 px-6 py-4 text-center sm:px-8">
              <p className="text-xs text-slate-600">
                Registered {formatEventDate(registration.createdAt)} · Please arrive 15 minutes early
                for check-in.
              </p>
            </div>
          </div>
        </Reveal>

        {isDemo ? (
          <p className="no-print mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-center text-sm text-amber-900">
            <strong className="font-extrabold">Demo data.</strong> This card is not a real
            registration.
          </p>
        ) : null}

        {/* next steps */}
        <div className="no-print mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Save this card", body: "Screenshot it or print it below." },
            { step: "2", title: "Come to the venue", body: "Bring your student ID and this number." },
            { step: "3", title: "Take part", body: "Join the activities to enter the draw." },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-soft">
              <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-leaf-600 text-sm font-extrabold text-white">
                {item.step}
              </span>
              <p className="mt-3 font-bold text-leaf-950">{item.title}</p>
              <p className="mt-1 text-xs text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>

        {settings?.prizeClaimNote ? (
          <p className="no-print mx-auto mt-6 max-w-2xl rounded-2xl border border-azure-200 bg-azure-50 px-4 py-3 text-center text-sm text-azure-600">
            {settings.prizeClaimNote}
          </p>
        ) : null}

        <div className="no-print mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-3">
          <PrintButton />
          <ButtonLink href="/event" variant="secondary" size="lg">
            About the event
          </ButtonLink>
          <ButtonLink href="/account" variant="ghost" size="lg">
            My account
          </ButtonLink>
        </div>

        <p className="no-print mx-auto mt-6 flex max-w-2xl items-start gap-2 text-center text-xs text-slate-500 sm:text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
          <span>
            This page shows only your entry number. Your name, e-mail, phone and student ID are
            never printed or shared. Need help?{" "}
            <Link href="/account" className="font-semibold text-leaf-700 underline underline-offset-2">
              Sign in to your account
            </Link>{" "}
            or e-mail {url ? "the organiser" : "us"}.
          </span>
        </p>

        <details className="no-print mx-auto mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Add this page to your home screen
          </summary>
          <p className="mt-2 text-slate-600">
            Open this page in your browser and use &ldquo;Add to Home Screen&rdquo;. It works
            offline and never asks for notifications.
          </p>
        </details>
      </div>
    </section>
  );
}
