import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Lock, MonitorUp, Shuffle, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { getDrawCounts } from "@/server/services/draw-service";
import { confirmationCode } from "@/lib/utils";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { DrawConsole, type ConsoleState } from "@/components/admin/draw-console";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/toast";
import { isRegistrationOpen } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Lucky draw" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "not-found": "That event could not be found.",
  "not-demo":
    "Rehearsal reset is only available for demo events. A real draw can never be cleared.",
  "bad-code": "The confirmation code did not match, so nothing was reset.",
};

export default async function AdminDrawPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/draw");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to run its draw.</p>
        </Panel>
      </PageBody>
    );
  }

  const [counts, draw, prizes] = await Promise.all([
    getDrawCounts(event.id),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: {
        id: true,
        status: true,
        poolLockedAt: true,
        poolSnapshotHash: true,
        selectionDigest: true,
        selectionEntropy: true,
      },
    }),
    prisma.prize.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
      select: { name: true, quantity: true, order: true },
    }),
  ]);

  const winners = draw
    ? await prisma.winner.findMany({
        where: { drawId: draw.id, claimStatus: { not: "REVOKED" } },
        orderBy: [{ prize: { order: "asc" } }, { selectedAt: "asc" }],
        select: { entryNumber: true, prize: { select: { name: true, order: true } } },
      })
    : [];

  const totalSlots = prizes.reduce((sum, prize) => sum + prize.quantity, 0);

  const consoleState: ConsoleState = {
    status: (draw?.status as ConsoleState["status"]) ?? "NOT_STARTED",
    eligibleCount: counts.eligible,
    totalSlots,
    prizes,
    lockedAt: draw?.poolLockedAt?.toISOString() ?? null,
    poolHash: draw?.poolSnapshotHash ?? null,
    commitHash: draw?.selectionDigest ?? null,
    entropy: draw?.selectionEntropy ?? null,
    drawId: draw?.id ?? null,
    isDemo: event.isDemo,
    publicDrawScreen: event.settings.publicDrawScreenVisible,
    winners: winners.map((winner) => ({
      entryNumber: winner.entryNumber,
      prizeName: winner.prize.name,
      prizeOrder: winner.prize.order,
    })),
  };

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const registrationOpen = isRegistrationOpen(event);

  return (
    <PageBody>
      <PageHeader
        title="Lucky draw"
        description="Three steps, in order. Two of them cannot be undone, so both ask you to type a confirmation code first."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {event.name}
            </span>
            {event.isDemo ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-800">
                Demo data
              </span>
            ) : null}
            {consoleState.status === "COMPLETED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-leaf-800">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Permanent
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <ButtonLink href={withEvent("/admin/eligibility", event.id)} variant="secondary" size="sm">
              Review eligibility
            </ButtonLink>
            <ButtonLink
              href={`/draw/display?event=${event.id}`}
              variant="outline"
              size="sm"
              target="_blank"
            >
              <MonitorUp className="h-4 w-4" aria-hidden="true" />
              Projector view
            </ButtonLink>
          </>
        }
      />

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {saved === "status" ? <FormAlert tone="success">Event status updated.</FormAlert> : null}
      {saved === "rehearsal-reset" ? (
        <FormAlert tone="success" title="Rehearsal reset">
          The demo draw, its snapshot and its winners were cleared. The audit log keeps the record of
          what happened.
        </FormAlert>
      ) : null}
      {saved === "nothing-to-reset" ? (
        <FormAlert tone="info">There was no demo draw to clear.</FormAlert>
      ) : null}

      {/* eligibility summary — the numbers that decide the fairness of the draw */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Eligible entries"
          value={counts.eligible}
          tone="leaf"
          hint={
            consoleState.status === "NOT_STARTED"
              ? "Live until you lock"
              : "From the frozen snapshot"
          }
        />
        <StatTile
          label="Prize slots"
          value={totalSlots}
          tone="gold"
          hint={`${prizes.length} prize ${prizes.length === 1 ? "type" : "types"}`}
        />
        <StatTile
          label="Not yet reviewed"
          value={counts.pending}
          tone={counts.pending > 0 ? "red" : "slate"}
          hint="Attendance undecided"
        />
        <StatTile
          label="Missing draw consent"
          value={counts.eligibleWithoutDrawConsent}
          tone={counts.eligibleWithoutDrawConsent > 0 ? "red" : "slate"}
          hint="Excluded automatically"
        />
      </div>

      {registrationOpen && consoleState.status === "NOT_STARTED" ? (
        <FormAlert tone="warning" title="Registration is still open">
          The draw cannot be locked while registration is open.{" "}
          <Link
            href={withEvent(`/admin/events/${event.id}`, event.id)}
            className="font-bold underline underline-offset-2"
          >
            Set the event to REGISTRATION_CLOSED
          </Link>{" "}
          once you are happy with the list.
        </FormAlert>
      ) : null}

      {!consoleState.publicDrawScreen ? (
        <FormAlert tone="info">
          The live draw screen is hidden from the public for this event, so participants will only
          see the result on the winners page.
        </FormAlert>
      ) : null}

      <DrawConsole
        state={consoleState}
        eventId={event.id}
        expectedCode={confirmationCode(event.slug)}
        registrationOpen={registrationOpen}
      />

      {/* the algorithm, published before the draw runs */}
      <Panel title="How the winner is chosen" description="The same code decides every draw, and anyone can check the result afterwards.">
        <ol className="space-y-3 text-sm leading-relaxed text-slate-700">
          {[
            "Read every eligible entry number from the frozen snapshot, sorted, so the starting order is fixed and public.",
            "Ask the operating system for cryptographically secure random bytes. Not a shuffled array, not a seeded generator.",
            "Publish a hash of those bytes as a commitment — before any winner is chosen.",
            "Fisher-Yates shuffle the list using those bytes, then take the first entry for the first prize, the next for the second, and so on.",
            "Store the winners, then reveal the raw bytes so the shuffle can be replayed exactly.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-leaf-50 p-3 text-xs leading-relaxed text-leaf-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Because the commitment is published first and a hash cannot be reversed, the organiser
            cannot choose a seed after seeing who would win.{" "}
            <Link href="/rules" className="font-semibold underline underline-offset-2">
              The published rules say the same thing in plain language.
            </Link>
          </span>
        </p>
        {draw?.selectionEntropy ? (
          <div className="mt-4">
            <CopyButton
              value={JSON.stringify(
                {
                  poolHash: draw.poolSnapshotHash,
                  commitHash: draw.selectionDigest,
                  seed: draw.selectionEntropy,
                },
                null,
                2,
              )}
              label="Copy the verification data as JSON"
            />
          </div>
        ) : null}
      </Panel>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
        Winners are managed on the{" "}
        <Link
          href={withEvent("/admin/winners", event.id)}
          className="font-semibold text-leaf-700 underline underline-offset-2"
        >
          winners page
        </Link>
        .
      </p>
    </PageBody>
  );
}
