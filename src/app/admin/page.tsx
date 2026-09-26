import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Gift,
  ListChecks,
  MonitorUp,
  QrCode,
  ScrollText,
  ShieldCheck,
  Shuffle,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { getDrawCounts } from "@/server/services/draw-service";
import { DataRow, PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { EventStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTimeUtc, formatEventDate, formatRelativeDeadline, formatTimeRange } from "@/lib/format";
import { registerUrl } from "@/lib/qr";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <EmptyState
          icon="🎪"
          title="No event yet"
          description="Create your first event to open registration and start collecting participants."
          action={<ButtonLink href="/admin/events/new">Create an event</ButtonLink>}
        />
      </PageBody>
    );
  }

  const [counts, draw, prizes, recentAudit, winnerCount] = await Promise.all([
    getDrawCounts(event.id),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: { id: true, status: true, poolLockedAt: true, completedAt: true, poolSnapshotHash: true },
    }),
    prisma.prize.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
      select: { name: true, quantity: true, order: true },
    }),
    prisma.auditLog.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, targetType: true },
    }),
    prisma.winner.count({ where: { eventId: event.id, claimStatus: { not: "REVOKED" } } }),
  ]);

  const prizeSlots = prizes.reduce((sum, prize) => sum + prize.quantity, 0);
  const locked = Boolean(draw?.poolLockedAt);
  const completed = draw?.status === "COMPLETED";

  // The next action the organiser actually needs to take.
  const nextStep = completed
    ? {
        title: "Track prize claims",
        body: "The draw is done. Mark prizes as claimed and record any corrections.",
        href: withEvent("/admin/winners", event.id),
        cta: "Manage winners",
        icon: Gift,
        tone: "success" as const,
      }
    : locked
      ? {
          title: "Run the draw",
          body: `${counts.eligible} eligible ${
            counts.eligible === 1 ? "entry is" : "entries are"
          } frozen. Running the draw is final and cannot be repeated.`,
          href: withEvent("/admin/draw", event.id),
          cta: "Open the draw console",
          icon: Shuffle,
          tone: "warning" as const,
        }
      : counts.pending > 0
        ? {
            title: "Confirm who took part",
            body: `${counts.pending} confirmed ${
              counts.pending === 1 ? "participant has" : "participants have"
            } not been marked as participated yet.`,
            href: withEvent("/admin/eligibility", event.id),
            cta: "Review eligibility",
            icon: ListChecks,
            tone: "default" as const,
          }
        : {
            title: "Lock the participant pool",
            body: `${counts.eligible} eligible ${
              counts.eligible === 1 ? "entry" : "entries"
            } against ${prizeSlots} prize ${prizeSlots === 1 ? "slot" : "slots"}.`,
            href: withEvent("/admin/draw", event.id),
            cta: "Open the draw console",
            icon: Shuffle,
            tone: "default" as const,
          };

  const StepIcon = nextStep.icon;

  return (
    <PageBody>
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
              {formatEventDate(event.startAt)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {formatTimeRange(event.startAt, event.endAt)}
            </span>
          </>
        }
        actions={
          <>
            <ButtonLink href={withEvent("/admin/participants", event.id)} variant="secondary" size="sm">
              <Users className="h-4 w-4" aria-hidden="true" />
              Participants
            </ButtonLink>
            <ButtonLink href={withEvent("/admin/export", event.id)} variant="outline" size="sm">
              Export
            </ButtonLink>
          </>
        }
      />

      {/* next step */}
      <Panel tone={nextStep.tone}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-600 text-white">
              <StepIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
                Next step
              </p>
              <h2 className="font-display text-lg font-extrabold text-leaf-950">{nextStep.title}</h2>
              <p className="mt-0.5 text-sm text-slate-600">{nextStep.body}</p>
            </div>
          </div>
          <ButtonLink href={nextStep.href} size="md">
            {nextStep.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Panel>

      {/* key numbers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Confirmed registrations"
          value={counts.confirmed}
          hint={event.capacity ? `Capacity ${event.capacity}` : "No capacity limit"}
          icon={<Users className="h-3 w-3" aria-hidden="true" />}
        />
        <StatTile
          label="Marked participated"
          value={counts.participated}
          hint={`${counts.pending} still to confirm`}
          tone="azure"
          icon={<ListChecks className="h-3 w-3" aria-hidden="true" />}
        />
        <StatTile
          label="Eligible for the draw"
          value={counts.eligible}
          hint={locked ? "Frozen into the pool snapshot" : "Live until you lock the pool"}
          tone="leaf"
          icon={<Shuffle className="h-3 w-3" aria-hidden="true" />}
        />
        <StatTile
          label="Prize slots"
          value={prizeSlots}
          hint={`${prizes.length} prize ${prizes.length === 1 ? "type" : "types"} configured`}
          tone="gold"
          icon={<Gift className="h-3 w-3" aria-hidden="true" />}
        />
      </div>

      {/* warnings that need attention */}
      {(counts.eligibleWithoutDrawConsent > 0 || prizeSlots === 0 || !completed && locked === false && counts.eligible === 0) ? (
        <Panel tone="warning" title="Before you lock the pool">
          <ul className="space-y-2.5 text-sm">
            {prizeSlots === 0 ? (
              <li className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-amber-900">
                <span aria-hidden="true">🎁</span>
                <span>
                  <strong className="font-extrabold">No prizes configured.</strong> The draw cannot
                  run until at least one prize exists.{" "}
                  <Link
                    href={withEvent("/admin/prizes", event.id)}
                    className="font-semibold underline underline-offset-2"
                  >
                    Add prizes
                  </Link>
                  .
                </span>
              </li>
            ) : null}
            {counts.eligibleWithoutDrawConsent > 0 ? (
              <li className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-amber-900">
                <span aria-hidden="true">⚠️</span>
                <span>
                  <strong className="font-extrabold">
                    {counts.eligibleWithoutDrawConsent} eligible participant(s) never ticked the draw
                    consent box.
                  </strong>{" "}
                  They cannot be selected. Mark them ineligible so the pool matches the rules.{" "}
                  <Link
                    href={withEvent("/admin/eligibility", event.id)}
                    className="font-semibold underline underline-offset-2"
                  >
                    Review
                  </Link>
                  .
                </span>
              </li>
            ) : null}
            {counts.eligible > prizeSlots ? (
              <li className="flex gap-2.5 rounded-xl bg-azure-50 p-3 text-azure-600">
                <span aria-hidden="true">ℹ️</span>
                <span>
                  {counts.eligible} eligible entries for {prizeSlots} prize slots. About{" "}
                  {counts.eligible % Math.max(1, prizeSlots) === 0
                    ? "1 in"
                    : `1 in ${Math.ceil(counts.eligible / Math.max(1, prizeSlots))}`}{" "}
                  {Math.ceil(counts.eligible / Math.max(1, prizeSlots))} will win — a rough guide
                  only, since the draw is uniform.
                </span>
              </li>
            ) : null}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* event facts */}
        <Panel title="Event" actions={<ButtonLink href={withEvent(`/admin/events/${event.id}`, event.id)} variant="outline" size="sm">Edit</ButtonLink>}>
          <dl>
            <DataRow label="Location">{event.locationName}</DataRow>
            <DataRow label="Registration closes">
              {formatEventDate(event.registrationDeadline)}
              <span className="ml-1.5 text-slate-500">
                ({formatRelativeDeadline(event.registrationDeadline)})
              </span>
            </DataRow>
            <DataRow label="Organiser">
              {event.organizerName}
              {event.organizerDepartment ? ` · ${event.organizerDepartment}` : ""}
            </DataRow>
            <DataRow label="Public URL" mono>
              {registerUrl(event.slug)}
            </DataRow>
            <DataRow label="Slug" mono>
              /{event.slug}
            </DataRow>
            <DataRow label="Participation required for eligibility">
              {event.settings.requireParticipationForEligibility ? "Yes" : "No"}
            </DataRow>
            <DataRow label="Public winners page">
              {event.settings.publicWinnersVisible ? "Visible" : "Hidden"}
            </DataRow>
            <DataRow label="Live draw screen">
              {event.settings.publicDrawScreenVisible ? "Public" : "Organisers only"}
            </DataRow>
          </dl>

          <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <ButtonLink
              href={`/api/events/${event.id}/qr`}
              variant="secondary"
              size="sm"
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Download QR
            </ButtonLink>
            <ButtonLink
              href={`/api/events/${event.id}/poster`}
              variant="secondary"
              size="sm"
            >
              Download poster
            </ButtonLink>
            <ButtonLink href={withEvent(`/draw/display?event=${event.id}`, event.id)} variant="ghost" size="sm">
              <MonitorUp className="h-4 w-4" aria-hidden="true" />
              Projector view
            </ButtonLink>
          </div>
        </Panel>

        {/* draw state */}
        <Panel
          title="Draw state"
          actions={
            <ButtonLink href={withEvent("/admin/draw", event.id)} variant="outline" size="sm">
              Open console
            </ButtonLink>
          }
        >
          <dl>
            <DataRow label="Official draw">
              {draw ? (
                <span
                  className={
                    completed
                      ? "text-leaf-700"
                      : locked
                        ? "text-amber-700"
                        : "text-slate-700"
                  }
                >
                  {draw.status}
                </span>
              ) : (
                "Not created yet"
              )}
            </DataRow>
            <DataRow label="Pool locked">
              {draw?.poolLockedAt ? formatDateTimeUtc(draw.poolLockedAt) : "Not locked"}
            </DataRow>
            <DataRow label="Pool fingerprint" mono>
              {draw?.poolSnapshotHash ? `${draw.poolSnapshotHash.slice(0, 24)}…` : "—"}
            </DataRow>
            <DataRow label="Draw completed">
              {draw?.completedAt ? formatDateTimeUtc(draw.completedAt) : "—"}
            </DataRow>
            <DataRow label="Winners recorded">{winnerCount}</DataRow>
          </dl>

          {completed ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-leaf-50 p-3 text-xs leading-relaxed text-leaf-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This draw is permanent. Any mistake is fixed with an appended correction, never by
                re-running the draw.
              </span>
            </p>
          ) : (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Registration must be closed before the pool can be locked. Change the event status
                to <strong>REGISTRATION_CLOSED</strong> on the edit page.
              </span>
            </p>
          )}
        </Panel>
      </div>

      {/* prizes */}
      <Panel
        title="Prizes"
        description="Drawn in this order. The order is part of the draw definition."
        actions={
          <ButtonLink href={withEvent("/admin/prizes", event.id)} variant="outline" size="sm">
            Manage
          </ButtonLink>
        }
        bodyClassName="p-0"
      >
        {prizes.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No prizes configured yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {prizes.map((prize) => (
              <li key={prize.order} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
                  {prize.order}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {prize.name}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  ×{prize.quantity}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {/* recent activity */}
      <Panel
        title="Recent activity"
        description="The ten most recent sensitive actions for this event."
        actions={
          <ButtonLink href={withEvent("/admin/audit", event.id)} variant="ghost" size="sm">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            Full log
          </ButtonLink>
        }
        bodyClassName="p-0"
      >
        {recentAudit.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentAudit.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="shrink-0 font-mono text-[0.7rem] text-slate-400">
                  {log.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                  {log.targetType ?? "—"}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDateTimeUtc(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageBody>
  );
}
