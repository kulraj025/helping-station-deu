import type { Metadata } from "next";
import { Gift, Lock, Shuffle } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { PrizeManager, type AdminPrize } from "@/components/admin/prize-manager";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";

export const metadata: Metadata = { title: "Prizes" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  locked: "Prizes are frozen because the participant pool has been locked.",
  "has-winners": "That prize already has a winner, so it cannot be deleted. Revoke the winner instead.",
  "not-found": "That prize could not be found.",
};

export default async function AdminPrizesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/prizes");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to manage its prizes.</p>
        </Panel>
      </PageBody>
    );
  }

  const [rows, draw] = await Promise.all([
    prisma.prize.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
      include: { _count: { select: { winners: true } } },
    }),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: { poolLockedAt: true, status: true },
    }),
  ]);

  const locked = Boolean(draw?.poolLockedAt);
  const slots = rows.reduce((sum, prize) => sum + prize.quantity, 0);
  const awarded = rows.reduce((sum, prize) => sum + prize._count.winners, 0);

  const prizes: AdminPrize[] = rows.map((prize) => ({
    id: prize.id,
    name: prize.name,
    description: prize.description,
    quantity: prize.quantity,
    order: prize.order,
    claimInstructions: prize.claimInstructions,
    winnerCount: prize._count.winners,
  }));

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const saved = typeof params.saved === "string" ? params.saved : null;

  return (
    <PageBody>
      <PageHeader
        title="Prizes"
        description="The prize table is part of the draw definition: quantity becomes the number of winning slots, and order decides who is drawn first."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {event.name}
            </span>
            {locked ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-800">
                <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Frozen
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

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {saved === "deleted" ? <FormAlert tone="success">Prize deleted.</FormAlert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Prize types"
          value={rows.length}
          icon={<Gift className="h-3 w-3" aria-hidden="true" />}
        />
        <StatTile label="Winning slots" value={slots} tone="gold" hint="Total quantity" />
        <StatTile
          label="Already awarded"
          value={awarded}
          tone="leaf"
          hint={draw?.status === "COMPLETED" ? "Draw complete" : "Draw not run yet"}
        />
      </div>

      {event.settings.prizeClaimNote ? (
        <Panel title="Claim note (public)">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {event.settings.prizeClaimNote}
          </p>
        </Panel>
      ) : null}

      <Panel
        title="Prize table"
        description="One winner per participant by default, so a person cannot hold two prizes."
      >
        <PrizeManager eventId={event.id} prizes={prizes} locked={locked} />
      </Panel>
    </PageBody>
  );
}
