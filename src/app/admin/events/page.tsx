import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAdminScope, withEvent } from "@/server/admin/scope";
import { prisma } from "@/lib/prisma";
import { PageBody, PageHeader, Panel } from "@/components/admin/page-parts";
import { EventStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FormAlert } from "@/components/ui/input";
import { formatDateTimeUtc, formatEventDate, formatRelativeDeadline } from "@/lib/format";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "not-found": "That event could not be found.",
  "bad-status": "Unknown status.",
  "draw-complete": "The draw for this event is complete, so the event must be COMPLETED or ARCHIVED.",
  "past-deadline":
    "The registration deadline is in the past, so this event cannot be published for registration.",
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/events");
  const scope = await getAdminScope(params, admin);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  const events = await prisma.event.findMany({
    orderBy: { startAt: "desc" },
    include: { _count: { select: { registrations: true, prizes: true } } },
  });

  return (
    <PageBody>
      <PageHeader
        title="Events"
        description="Every edition of the programme, past and future. Pick one to work on."
        actions={
          <ButtonLink href="/admin/events/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New event
          </ButtonLink>
        }
      />

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {events.length === 0 ? (
        <EmptyState
          icon="🎪"
          title="No events yet"
          description="Create the first edition to open registration."
          action={<ButtonLink href="/admin/events/new">Create an event</ButtonLink>}
        />
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {events.map((event) => {
              const current = event.id === scope.event?.id;
              return (
                <li key={event.id} className={current ? "bg-leaf-50/50" : undefined}>
                  <Link
                    href={withEvent(`/admin/events/${event.id}`, event.id)}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-extrabold text-leaf-950">
                          {event.name}
                        </span>
                        <EventStatusBadge status={event.status} />
                        {event.isDemo ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-amber-800">
                            Demo
                          </span>
                        ) : null}
                        {current ? (
                          <span className="rounded-full bg-leaf-600 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white">
                            In scope
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatEventDate(event.startAt)}
                        </span>
                        <span>Closes {formatRelativeDeadline(event.registrationDeadline)}</span>
                        <span className="font-mono">/{event.slug}</span>
                        <span>Updated {formatDateTimeUtc(event.updatedAt)}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <span className="rounded-lg bg-white px-3 py-1.5 text-center ring-1 ring-slate-200">
                        <span className="block text-sm font-extrabold text-leaf-900">
                          {event._count.registrations}
                        </span>
                        <span className="block text-[0.6rem] font-bold uppercase tracking-wide text-slate-500">
                          Registered
                        </span>
                      </span>
                      <span className="rounded-lg bg-white px-3 py-1.5 text-center ring-1 ring-slate-200">
                        <span className="block text-sm font-extrabold text-leaf-900">
                          {event._count.prizes}
                        </span>
                        <span className="block text-[0.6rem] font-bold uppercase tracking-wide text-slate-500">
                          Prizes
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </PageBody>
  );
}
