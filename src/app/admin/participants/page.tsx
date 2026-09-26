import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { listParticipants } from "@/server/services/participant-service";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { ParticipantTable, type AdminParticipant } from "@/components/admin/participant-table";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";
import { UserSearch } from "lucide-react";

export const metadata: Metadata = { title: "Participants" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/participants");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to see its participants.</p>
        </Panel>
      </PageBody>
    );
  }

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const query = typeof params.q === "string" ? params.q : undefined;

  const [result, cancelledCount, draw] = await Promise.all([
    listParticipants({
      eventId: event.id,
      page,
      pageSize: PAGE_SIZE,
      query,
      sort: "entry",
      direction: "asc",
    }),
    prisma.registration.count({ where: { eventId: event.id, registrationStatus: "CANCELLED" } }),
    prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      select: { poolLockedAt: true },
    }),
  ]);

  const locked = Boolean(draw?.poolLockedAt);
  const error = typeof params.error === "string" ? params.error : null;
  const saved = typeof params.saved === "string" ? params.saved : null;

  const participants: AdminParticipant[] = result.participants.map((row) => ({
    id: row.id,
    entryNumber: row.entryNumber,
    name: row.name,
    maskedStudentId: row.maskedStudentId,
    department: row.department,
    emailDomain: row.emailDomain,
    participationStatus: row.participationStatus,
    drawEligibility: row.drawEligibility,
    registrationStatus: row.registrationStatus,
    volunteerRole: row.volunteerRole,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    publicDisplayConsent: row.publicDisplayConsent,
    hasDrawConsent: row.hasDrawConsent,
    isAcademicEmail: row.isAcademicEmail,
    isDemo: row.isDemo,
    hasWon: row.hasWon,
  }));

  return (
    <PageBody>
      <PageHeader
        title="Participants"
        description="Everyone registered for this event. Attendance drives eligibility for the draw."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {event.name}
            </span>
            {locked ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-800">
                Pool locked
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <ButtonLink
              href={withEvent("/admin/eligibility", event.id)}
              variant="secondary"
              size="sm"
            >
              <UserSearch className="h-4 w-4" aria-hidden="true" />
              Bulk actions
            </ButtonLink>
            <ButtonLink
              href={withEvent("/admin/export?scope=participants", event.id)}
              variant="outline"
              size="sm"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </ButtonLink>
          </>
        }
      />

      {error ? (
        <FormAlert tone="error">
          {error === "not-found"
            ? "That registration could not be found."
            : decodeURIComponent(error.replace(/\+/g, " "))}
        </FormAlert>
      ) : null}
      {saved === "cancelled" ? <FormAlert tone="success">Registration cancelled.</FormAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Confirmed" value={result.total} tone="leaf" />
        <StatTile label="Cancelled" value={cancelledCount} tone="slate" />
        <StatTile
          label="Marked participated"
          value={
            participants.filter((participant) => participant.participationStatus === "PARTICIPATED").length
          }
          hint="On this page"
          tone="azure"
        />
        <StatTile
          label="Eligible"
          value={
            participants.filter((participant) => participant.drawEligibility === "ELIGIBLE").length
          }
          hint="On this page"
          tone="gold"
        />
      </div>

      <Panel
        title="All participants"
        description="Student IDs are masked here. Open the export page for the full CSV, which is itself logged."
        bodyClassName="p-4"
      >
        <ParticipantTable participants={participants} locked={locked} />
      </Panel>

      {result.totalPages > 1 ? (
        <nav aria-label="Pagination" className="no-print flex justify-center gap-2">
          {Array.from({ length: result.totalPages }, (_, index) => index + 1).map((number) => {
            const search = new URLSearchParams();
            if (query) search.set("q", query);
            search.set("page", String(number));
            return (
              <Link
                key={number}
                href={`/admin/participants?event=${event.id}&${search.toString()}`}
                aria-current={number === page ? "page" : undefined}
                className={
                  number === page
                    ? "grid h-9 w-9 place-items-center rounded-lg bg-leaf-700 text-sm font-bold text-white"
                    : "grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
                }
              >
                {number}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </PageBody>
  );
}
