import type { Metadata } from "next";
import { ListChecks, Lock, Shuffle } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { getDrawCounts } from "@/server/services/draw-service";
import { getEligibilitySummary as summary } from "@/server/services/participant-service";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import {
  EligibilityPanel,
  type BulkCandidate,
} from "@/components/admin/eligibility-panel";
import { ButtonLink } from "@/components/ui/button";
import { Meter } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Eligibility" };
export const dynamic = "force-dynamic";

export default async function AdminEligibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/eligibility");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to review eligibility.</p>
        </Panel>
      </PageBody>
    );
  }

  const [counts, summaryData, registrations, draw] = await Promise.all([
    getDrawCounts(event.id),
    summary(event.id),
    prisma.registration.findMany({
      where: { eventId: event.id, registrationStatus: "CONFIRMED" },
      orderBy: { entryNumber: "asc" },
      select: {
        id: true,
        entryNumber: true,
        participationStatus: true,
        drawEligibility: true,
        drawConsentAt: true,
        user: { select: { name: true, department: true } },
      },
    }),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: { poolLockedAt: true },
    }),
  ]);

  const locked = Boolean(draw?.poolLockedAt);

  const candidates: BulkCandidate[] = registrations.map((row) => ({
    id: row.id,
    entryNumber: row.entryNumber,
    name: row.user.name,
    department: row.user.department,
    participationStatus: row.participationStatus,
    drawEligibility: row.drawEligibility,
    hasDrawConsent: Boolean(row.drawConsentAt),
  }));

  const participation = summaryData.byParticipation;
  const eligibility = summaryData.byEligibility;
  const total = Math.max(1, summaryData.confirmed);

  return (
    <PageBody>
      <PageHeader
        title="Eligibility"
        description="Decide who is allowed into the draw. This is the step that most affects how fair the draw is."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {event.name}
            </span>
            {locked ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-800">
                <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Pool locked
              </span>
            ) : null}
          </>
        }
        actions={
          <ButtonLink href={withEvent("/admin/draw", event.id)} variant="secondary" size="sm">
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            Draw console
          </ButtonLink>
        }
      />

      {/* current split */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Eligible now"
          value={counts.eligible}
          tone="leaf"
          hint={`${Math.round((counts.eligible / total) * 100)}% of confirmed registrations`}
        />
        <StatTile
          label="Not reviewed"
          value={participation.PENDING_REVIEW ?? 0}
          tone="gold"
          hint="Attendance not yet decided"
        />
        <StatTile
          label="No-shows"
          value={counts.noShow}
          tone="red"
          hint={counts.ineligible ? `${counts.ineligible} marked ineligible` : undefined}
        />
        <StatTile
          label="Missing draw consent"
          value={counts.eligibleWithoutDrawConsent}
          tone={counts.eligibleWithoutDrawConsent > 0 ? "red" : "slate"}
          hint="Excluded from the pool"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Attendance" description="Who actually turned up.">
          <ul className="space-y-3">
            <li>
              <Meter
                value={participation.PARTICIPATED ?? 0}
                max={total}
                label={`Took part (${participation.PARTICIPATED ?? 0})`}
                tone="leaf"
              />
            </li>
            <li>
              <Meter
                value={participation.NO_SHOW ?? 0}
                max={total}
                label={`No-show (${participation.NO_SHOW ?? 0})`}
                tone="azure"
              />
            </li>
            <li>
              <Meter
                value={participation.PENDING_REVIEW ?? 0}
                max={total}
                label={`Not reviewed (${participation.PENDING_REVIEW ?? 0})`}
                tone="gold"
              />
            </li>
          </ul>
        </Panel>

        <Panel title="Draw eligibility" description="Who can be selected.">
          <ul className="space-y-3">
            <li>
              <Meter
                value={eligibility.ELIGIBLE ?? 0}
                max={total}
                label={`Eligible (${eligibility.ELIGIBLE ?? 0})`}
                tone="leaf"
              />
            </li>
            <li>
              <Meter
                value={eligibility.INELIGIBLE ?? 0}
                max={total}
                label={`Ineligible (${eligibility.INELIGIBLE ?? 0})`}
                tone="azure"
              />
            </li>
            <li>
              <Meter
                value={eligibility.EXCLUDED ?? 0}
                max={total}
                label={`Excluded (${eligibility.EXCLUDED ?? 0})`}
                tone="gold"
              />
            </li>
          </ul>
        </Panel>

        <Panel title="The rule in force" tone={summaryData.requireParticipation ? "success" : "warning"}>
          <p className="text-sm leading-relaxed text-slate-700">
            {summaryData.requireParticipation ? (
              <>
                Attendance <strong>must</strong> be confirmed for somebody to be eligible. Until you
                do, they are counted as pending and excluded from the pool.
              </>
            ) : (
              <>
                Attendance confirmation is switched <strong>off</strong> for this event. Anyone who
                registers can win, including people who never arrive. Turn it on unless you have a
                reason not to.
              </>
            )}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Draw consent is {event.settings.requireDrawConsent ? "required" : "not required"}.
            {event.settings.requireDrawConsent
              ? " Participants who did not tick the box are excluded from the pool automatically."
              : " Everyone confirmed is in the pool whether or not they ticked the box."}
          </p>
        </Panel>
      </div>

      <Panel
        title="Review and apply"
        description="Tick participants, choose the change, apply. Every applied change is written to the audit log."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            {candidates.length} confirmed
          </span>
        }
      >
        <EligibilityPanel
          eventId={event.id}
          candidates={candidates}
          locked={locked}
          requireParticipation={summaryData.requireParticipation}
        />
      </Panel>
    </PageBody>
  );
}
