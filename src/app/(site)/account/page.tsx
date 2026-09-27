import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Ticket,
  Trophy,
  Clock,
  UserRound,
  Mail,
} from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getRegistrationsForUser } from "@/server/services/registration-service";
import { parseEventSettings } from "@/lib/event-settings";
import {
  CancelRegistrationButton,
  PrivacyNote,
  SetPasswordPanel,
  SignOutButton,
} from "@/components/public/account-panels";
import { PrintButton } from "@/components/public/print-button";
import { ButtonLink } from "@/components/ui/button";
import { EligibilityBadge, ParticipationBadge, RegistrationBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Reveal } from "@/components/ui/reveal";
import { formatEventDate, formatTimeRange, formatDateTime } from "@/lib/format";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "My participation",
  description:
    "Your own registrations, participation status and any prizes from Helping Station DEU. Sign in to check in, withdraw, or see your entry number.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/account");
  const registrations = await getRegistrationsForUser(user.id);

  // Claim-code accounts can set a password on first sign-in.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, claimCodeHash: true, createdAt: true },
  });
  const needsPassword = !account?.passwordHash;

  const error = params.error === "forbidden" ? "forbidden" : null;

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-30" aria-hidden="true" />
      <div className="container-page relative">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong className="font-bold">Organiser area only.</strong> Your student account cannot
            open the admin dashboard. If you are an organiser, sign in with your organiser account.
          </div>
        ) : null}

        <Reveal from="up" className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-leaf-950 sm:text-4xl">
              My participation
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <UserRound className="h-4 w-4 text-leaf-600" aria-hidden="true" />
                {user.name}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-azure-500" aria-hidden="true" />
                {user.email}
              </span>
              {user.department ? (
                <span className="flex items-center gap-1.5">
                  <Ticket className="h-4 w-4 text-gold-500" aria-hidden="true" />
                  {user.department}
                </span>
              ) : null}
            </p>
          </div>
          <SignOutButton />
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
          {/* registrations */}
          <div className="space-y-5">
            {registrations.length === 0 ? (
              <EmptyState
                icon="🎟️"
                title="No registrations yet"
                description="You have not registered for an event yet. It only takes a minute."
                action={
                  <ButtonLink href="/register">Register for the event</ButtonLink>
                }
              />
            ) : (
              registrations.map((registration) => {
                const settings = parseEventSettings(registration.event.settings);
                const cancelled = registration.registrationStatus === "CANCELLED";
                return (
                  <article
                    key={registration.id}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-soft ${
                      cancelled ? "border-slate-200 opacity-70" : "border-leaf-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-xl font-extrabold text-leaf-950">
                            {registration.event.name}
                          </h2>
                          {registration.event.isDemo ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-amber-800">
                              Demo
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-leaf-600" aria-hidden="true" />
                            {formatEventDate(registration.event.startAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-azure-500" aria-hidden="true" />
                            {formatTimeRange(registration.event.startAt, registration.event.endAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-gold-500" aria-hidden="true" />
                            {registration.event.locationName}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-2xl bg-leaf-50 px-5 py-3 text-center">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                          Entry number
                        </p>
                        <p className="font-display text-2xl font-extrabold text-leaf-900">
                          {registration.entryNumber}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-5 p-6 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <RegistrationBadge status={registration.registrationStatus} />
                          <ParticipationBadge status={registration.participationStatus} />
                          <EligibilityBadge status={registration.drawEligibility} />
                        </div>
                        {registration.eligibilityReason ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Organiser note: {registration.eligibilityReason}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Your choices
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                          <li>
                            Volunteer role:{" "}
                            <span className="font-semibold text-slate-800">
                              {registration.volunteerRole ?? "No preference"}
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            Lucky draw consent:{" "}
                            <span
                              className={`font-semibold ${
                                registration.drawConsentAt ? "text-leaf-700" : "text-slate-500"
                              }`}
                            >
                              {registration.drawConsentAt ? "Yes" : "No"}
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            Masked name shown publicly:{" "}
                            <span className="font-semibold text-slate-800">
                              {registration.publicDisplayConsent ? "Yes" : "No"}
                            </span>
                          </li>
                          <li>
                            Prize contact consent:{" "}
                            <span className="font-semibold text-slate-800">
                              {registration.contactConsentAt ? "Yes" : "No"}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {registration.winners.length > 0 ? (
                      <div className="border-t border-slate-100 bg-gold-300/20 p-6">
                        <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-leaf-950">
                          <Trophy className="h-5 w-5 text-gold-600" aria-hidden="true" />
                          You won!
                        </h3>
                        <ul className="mt-3 space-y-2">
                          {registration.winners.map((winner) => (
                            <li
                              key={winner.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3"
                            >
                              <span className="font-bold text-leaf-900">{winner.prize.name}</span>
                              <span className="text-xs text-slate-500">
                                {formatDateTime(winner.selectedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {settings.prizeClaimNote ? (
                          <p className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-relaxed text-slate-600">
                            <strong className="font-bold text-slate-800">How to claim:</strong>{" "}
                            {settings.prizeClaimNote}
                          </p>
                        ) : null}
                        {settings.winnerContactMethod ? (
                          <p className="mt-2 text-xs text-slate-600">
                            <strong className="font-bold text-slate-800">Contact:</strong>{" "}
                            {settings.winnerContactMethod}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-canvas px-6 py-4">
                      <PrintButton
                        label="Print card"
                        variant="secondary"
                      />
                      {cancelled ? (
                        <span className="text-sm font-semibold text-slate-500">
                          This registration was cancelled.
                        </span>
                      ) : (
                        <CancelRegistrationButton
                          registrationId={registration.id}
                          entryNumber={registration.entryNumber}
                        />
                      )}
                      <Link
                        href={`/event`}
                        className="ml-auto text-xs font-semibold text-slate-500 underline-offset-4 hover:underline"
                      >
                        Event details
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* side panel */}
          <aside className="space-y-5">
            {needsPassword ? <SetPasswordPanel /> : null}
            <PrivacyNote />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
              <p>
                <strong className="font-bold text-slate-700">Data retention.</strong> Registration
                records are kept for up to {env.dataRetentionDays} days after the event, then
                anonymised. Contact {env.contactEmail} to have your data deleted sooner.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
