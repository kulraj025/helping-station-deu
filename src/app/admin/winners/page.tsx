import type { Metadata } from "next";
import Link from "next/link";
import { Award, ScrollText, Shuffle } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { getAdminWinners } from "@/server/services/winner-service";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { WinnerManager, type ManagedWinner } from "@/components/admin/winner-manager";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";

export const metadata: Metadata = { title: "Winners" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "not-found": "That winner could not be found.",
  "no-consent":
    "That participant did not consent to being contacted, so no notification was queued. Ask them in person instead.",
};

export default async function AdminWinnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/winners");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to manage its winners.</p>
        </Panel>
      </PageBody>
    );
  }

  const [rows, draw] = await Promise.all([
    getAdminWinners(event.id),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: { status: true, completedAt: true, selectionDigest: true, poolSnapshotHash: true },
    }),
  ]);

  const prizeRows = await prisma.prize.findMany({
    where: { eventId: event.id },
    orderBy: { order: "asc" },
    select: { id: true, claimInstructions: true },
  });
  // The admin winner projection does not carry the prize id, so fetch the mapping
  // separately rather than guessing the prize from its name.
  const winnerPrizeIds = await prisma.winner.findMany({
    where: { eventId: event.id },
    select: { id: true, prizeId: true },
  });
  const prizeIdByWinner = new Map(winnerPrizeIds.map((row) => [row.id, row.prizeId]));
  const instructionsByPrize = new Map(
    prizeRows.map((prize) => [prize.id, prize.claimInstructions]),
  );

  const winners: ManagedWinner[] = rows.map((row) => ({
    id: row.id,
    entryNumber: row.entryNumber,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    department: row.department,
    studentId: row.studentId,
    prizeName: row.prizeName,
    prizeOrder: row.prizeOrder,
    claimStatus: row.claimStatus,
    selectedAt: row.selectedAt.toISOString(),
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    revokedReason: row.revokedReason,
    publicDisplayConsent: row.publicDisplayConsent,
    contactConsent: row.contactConsent,
    claimInstructions:
      (prizeIdByWinner.has(row.id)
        ? instructionsByPrize.get(prizeIdByWinner.get(row.id) as string)
        : null) ?? null,
    corrections: row.corrections.map((correction) => ({
      id: correction.id,
      type: correction.type,
      reason: correction.reason,
      createdAt: correction.createdAt.toISOString(),
    })),
  }));

  const active = winners.filter((winner) => winner.claimStatus !== "REVOKED");
  const claimed = winners.filter((winner) => winner.claimStatus === "CLAIMED");
  const revoked = winners.filter((winner) => winner.claimStatus === "REVOKED");
  const correctionCount = winners.reduce((sum, winner) => sum + winner.corrections.length, 0);

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const saved = typeof params.saved === "string" ? params.saved : null;

  return (
    <PageBody>
      <PageHeader
        title="Winners"
        description="Track who has collected their prize, and record mistakes as corrections rather than edits."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {event.name}
            </span>
            {event.settings.publicWinnersVisible ? (
              <span className="rounded-full bg-azure-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-azure-700">
                Published on /winners
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
                Not published
              </span>
            )}
          </>
        }
        actions={
          <>
            <ButtonLink href={withEvent("/admin/draw", event.id)} variant="secondary" size="sm">
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Draw console
            </ButtonLink>
            <ButtonLink href={withEvent("/admin/audit", event.id)} variant="outline" size="sm">
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              Audit log
            </ButtonLink>
          </>
        }
      />

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {saved === "notified" ? (
        <FormAlert tone="success" title="Notification queued">
          A notification record was created and the action was written to the audit log. Delivery
          happens in a separate step.
        </FormAlert>
      ) : null}

      {draw?.status !== "COMPLETED" ? (
        <FormAlert tone="info" title="The draw has not run yet">
          Nothing can be recorded here until the draw is complete.{" "}
          <Link
            href={withEvent("/admin/draw", event.id)}
            className="font-bold underline underline-offset-2"
          >
            Open the draw console
          </Link>
          .
        </FormAlert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Winners"
          value={active.length}
          tone="gold"
          icon={<Award className="h-3 w-3" aria-hidden="true" />}
        />
        <StatTile label="Collected" value={claimed.length} tone="leaf" hint="Prize handed over" />
        <StatTile
          label="Outstanding"
          value={active.length - claimed.length}
          tone={active.length - claimed.length > 0 ? "gold" : "slate"}
          hint={`${event.settings.claimWindowDays}-day window`}
        />
        <StatTile
          label="Corrections"
          value={correctionCount}
          tone={correctionCount > 0 ? "red" : "slate"}
          hint={revoked.length > 0 ? `${revoked.length} revoked` : "None appended"}
        />
      </div>

      <Panel
        title="Winner records"
        description="Contact details are behind a second click, and every change is written to the audit log."
        bodyClassName="p-0"
      >
        <WinnerManager winners={winners} claimWindowDays={event.settings.claimWindowDays} />
      </Panel>

      {event.settings.prizeClaimNote ? (
        <Panel title="Public claim note">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {event.settings.prizeClaimNote}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Shown on the public winners page. Contact method: {event.settings.winnerContactMethod}
          </p>
        </Panel>
      ) : null}
    </PageBody>
  );
}
