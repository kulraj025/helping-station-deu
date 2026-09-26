import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getEventById } from "@/server/services/event-service";
import { withEvent } from "@/server/admin/scope";
import { PageBody, PageHeader, Panel } from "@/components/admin/page-parts";
import { EventForm, toLocalInputValue, type EventFormValues } from "@/components/admin/event-form";
import { StatusChanger } from "@/components/admin/status-changer";
import { EventStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/toast";
import { registerUrl } from "@/lib/qr";
import { EVENT_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireAdmin(withEvent(`/admin/events/${id}`, id));

  const event = await getEventById(id);
  if (!event) notFound();

  const draw = await prisma.draw.findUnique({
    where: { eventId_official: { eventId: id, official: true } },
    select: { status: true, poolLockedAt: true },
  });
  const locked = Boolean(draw?.poolLockedAt);

  const [registrations, prizes] = await Promise.all([
    prisma.registration.count({ where: { eventId: id, registrationStatus: "CONFIRMED" } }),
    prisma.prize.count({ where: { eventId: id } }),
  ]);

  const values: EventFormValues = {
    id: event.id,
    name: event.name,
    tagline: event.tagline ?? "",
    description: event.description,
    locationName: event.locationName,
    locationAddress: event.locationAddress ?? "",
    startAt: toLocalInputValue(event.startAt),
    endAt: toLocalInputValue(event.endAt),
    registrationDeadline: toLocalInputValue(event.registrationDeadline),
    capacity: event.capacity ? String(event.capacity) : "",
    organizerName: event.organizerName,
    organizerDepartment: event.organizerDepartment ?? "",
    organizerContact: event.organizerContact ?? "",
    status: event.status,
    isDemo: event.isDemo,
    settings: {
      requireParticipationForEligibility: event.settings.requireParticipationForEligibility,
      allowMultipleWinsPerParticipant: event.settings.allowMultipleWinsPerParticipant,
      winnerDisplayMode: event.settings.winnerDisplayMode,
      publicWinnersVisible: event.settings.publicWinnersVisible,
      publicDrawScreenVisible: event.settings.publicDrawScreenVisible,
      showParticipantCount: event.settings.showParticipantCount,
      claimWindowDays: String(event.settings.claimWindowDays),
      requireDrawConsent: event.settings.requireDrawConsent,
      requireEmergencyContact: event.settings.requireEmergencyContact,
      prizeClaimNote: event.settings.prizeClaimNote,
      winnerContactMethod: event.settings.winnerContactMethod,
      complianceNote: event.settings.complianceNote,
    },
  };

  const saved = typeof query.saved === "string" ? query.saved : null;
  const error = typeof query.error === "string" ? query.error : null;
  const errorMessages: Record<string, string> = {
    "bad-status": "Unknown status.",
    "not-found": "That event could not be found.",
    "draw-complete":
      "The draw for this event is complete, so the event must be COMPLETED or ARCHIVED.",
    "past-deadline":
      "The registration deadline is in the past, so this event cannot be published for registration.",
  };

  return (
    <PageBody>
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-leaf-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All events
      </Link>

      <PageHeader
        title={event.name}
        description={event.tagline ?? undefined}
        meta={
          <>
            <EventStatusBadge status={event.status} />
            {event.isDemo ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-800">
                Demo data
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {registrations} registered
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {prizes} prize {prizes === 1 ? "type" : "types"}
            </span>
          </>
        }
        actions={
          <>
            <ButtonLink
              href={withEvent("/admin/participants", event.id)}
              variant="secondary"
              size="sm"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Participants
            </ButtonLink>
            <ButtonLink href={`/api/events/${event.id}/qr`} variant="outline" size="sm">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              QR code
            </ButtonLink>
          </>
        }
      />

      {error && errorMessages[error] ? (
        <FormAlert tone="error">{errorMessages[error]}</FormAlert>
      ) : null}
      {saved === "status" ? <FormAlert tone="success">Status updated.</FormAlert> : null}
      {saved === "created" ? <FormAlert tone="success">Event created.</FormAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Panel>
          <EventForm
            mode="edit"
            values={values}
            lockedFields={locked ? ["deadline", "drawRules"] : []}
          />
        </Panel>

        <div className="space-y-6">
          <StatusChanger
            eventId={event.id}
            currentStatus={event.status}
            statuses={EVENT_STATUSES}
            drawStatus={draw?.status ?? null}
          />

          <Panel title="Public link">
            <p className="text-sm text-slate-600">
              Share this on social media, posters and the QR code. The registration link is what the
              QR code encodes, so scanning it lands straight on the form.
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="break-all font-mono text-xs text-slate-700">
                {registerUrl(event.slug)}
              </p>
            </div>
            <div className="mt-3">
              <CopyButton value={registerUrl(event.slug)} label="Copy registration link" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink href={`/event/${event.slug}`} variant="secondary" size="sm">
                View the event page
              </ButtonLink>
              <ButtonLink href={`/register?event=${event.slug}`} variant="secondary" size="sm">
                View the registration form
              </ButtonLink>
              <ButtonLink href={`/api/events/${event.id}/poster`} variant="outline" size="sm">
                Download the poster
              </ButtonLink>
            </div>
          </Panel>

          {locked ? (
            <Panel tone="warning" title="Pool locked">
              <p className="text-sm leading-relaxed text-amber-900">
                The participant list is frozen into a hashed snapshot. The deadline and draw rules
                are locked with it. Correct mistakes through the{" "}
                <Link
                  href={withEvent("/admin/winners", event.id)}
                  className="font-bold underline underline-offset-2"
                >
                  winners corrections
                </Link>{" "}
                rather than by editing the pool.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </PageBody>
  );
}
