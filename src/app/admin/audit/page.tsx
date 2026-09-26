import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAdminScope } from "@/server/admin/scope";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { TableShell, Td, Th, Tr } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

/** Actions that touch eligibility or the draw are highlighted. */
const SENSITIVE = new Set([
  "registration.eligibility_changed",
  "registration.eligibility_bulk_changed",
  "registration.participation_verified",
  "registration.cancelled",
  "draw.pool_locked",
  "draw.completed",
  "draw.integrity_verified",
  "winner.revoked",
  "winner.claim_updated",
  "report.exported",
  "event.updated",
]);

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/audit");
  const scope = await getAdminScope(params, admin);

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const actionFilter = typeof params.action === "string" ? params.action : null;
  // The log is global by default, because an organiser debugging "who touched
  // this participant" often needs the entries from before this event existed.
  // `?event=` narrows it, which is what the sidebar switcher sends.
  const scopedEvent = scope.event;
  const where = {
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(scopedEvent ? { eventId: scopedEvent.id } : {}),
  };

  const [logs, total, actions, actorRows, exportCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        admin: { select: { name: true, email: true } },
        event: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["adminId"], _count: { _all: true }, orderBy: { _count: { adminId: "desc" } } }),
    prisma.auditLog.count({ where: { action: "report.exported" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Keeps the event and action filters together when a filter link is followed. */
  const href = (options: { action?: string | null; page?: number }) => {
    const search = new URLSearchParams();
    if (options.action) search.set("action", options.action);
    if (scopedEvent) search.set("event", scopedEvent.id);
    if (options.page && options.page > 1) search.set("page", String(options.page));
    const query = search.toString();
    return query ? `/admin/audit?${query}` : "/admin/audit";
  };

  return (
    <PageBody>
      <PageHeader
        title="Audit log"
        description="Append-only. Every sensitive action, who did it, when, and what it changed. Rows are never edited or deleted."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
              {total} entries
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-leaf-800">
              <ScrollText className="h-3 w-3" aria-hidden="true" />
              Append-only
            </span>
          </>
        }
        actions={
          <ButtonLink
            href={scopedEvent ? `/admin/export?event=${scopedEvent.id}&scope=audit` : "/admin/export"}
            variant="outline"
            size="sm"
          >
            Export the log
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label={scopedEvent ? "Entries for this event" : "Total entries"} value={total} />
        <StatTile label="Distinct action types" value={actions.length} tone="azure" />
        <StatTile
          label="Exports generated"
          value={exportCount}
          tone={exportCount > 0 ? "gold" : "slate"}
          hint="Exports are logged too"
        />
      </div>

      {/* event scope toggle */}
      <nav aria-label="Event scope" className="no-print flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Scope</span>
        <Link
          href={href({ action: actionFilter })}
          aria-current={scopedEvent ? undefined : "page"}
          className={
            scopedEvent
              ? "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
              : "rounded-full bg-leaf-700 px-3 py-1.5 text-xs font-bold text-white"
          }
        >
          All events
        </Link>
        {scope.events.map((option) => (
          <Link
            key={option.id}
            href={`/admin/audit?event=${option.id}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ""}`}
            aria-current={scopedEvent?.id === option.id ? "page" : undefined}
            className={
              scopedEvent?.id === option.id
                ? "rounded-full bg-leaf-700 px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
            }
          >
            {option.name}
          </Link>
        ))}
      </nav>

      {/* filters */}
      <nav aria-label="Filter by action" className="no-print flex flex-wrap gap-1.5">
        <Link
          href={href({ action: null })}
          aria-current={actionFilter ? undefined : "page"}
          className={
            actionFilter
              ? "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
              : "rounded-full bg-leaf-700 px-3 py-1.5 text-xs font-bold text-white"
          }
        >
          All
        </Link>
        {actions.map((row) => (
          <Link
            key={row.action}
            href={href({ action: row.action })}
            aria-current={actionFilter === row.action ? "page" : undefined}
            className={
              actionFilter === row.action
                ? "rounded-full bg-leaf-700 px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
            }
          >
            {AUDIT_ACTION_LABELS[row.action] ?? row.action}
            <span className="ml-1.5 text-[0.65rem] opacity-70">{row._count._all}</span>
          </Link>
        ))}
      </nav>

      {actorRows.length > 1 ? (
        <Panel title="Who acts" description="Entries are attributed to a signed-in organiser account.">
          <ul className="flex flex-wrap gap-2">
            {actorRows.map((row) => (
              <li
                key={row.adminId ?? "system"}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {row.adminId ?? "system / automated"}
                <span className="ml-1.5 text-slate-400">{row._count._all}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel bodyClassName="p-0">
        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Nothing logged yet. Actions appear here as soon as somebody uses the organiser area.
          </p>
        ) : (
          <TableShell className="min-w-[52rem]">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Who</Th>
                <Th>Event</Th>
                <Th>Target</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const metadata =
                  log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
                    ? (log.metadata as Record<string, unknown>)
                    : null;
                const sensitive = SENSITIVE.has(log.action);

                return (
                  <Tr key={log.id} className={sensitive ? "bg-amber-50/40" : undefined}>
                    <Td>
                      <span className="whitespace-nowrap text-xs text-slate-600">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={
                          sensitive
                            ? "block text-xs font-bold text-amber-800"
                            : "block text-xs font-semibold text-slate-700"
                        }
                      >
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="block font-mono text-[0.65rem] text-slate-400">
                        {log.action}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-700">
                        {log.admin?.name ?? "system"}
                        {log.admin?.email ? (
                          <span className="block text-[0.65rem] text-slate-400">{log.admin.email}</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-600">
                        {log.event?.name ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-500">
                        {log.targetType ?? "—"}
                        {log.targetId ? (
                          <span className="block font-mono text-[0.65rem] text-slate-400">
                            {log.targetId.slice(0, 10)}…
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    <Td>
                      {metadata ? (
                        <details className="max-w-xs">
                          <summary className="cursor-pointer list-none text-[0.7rem] font-semibold text-leaf-700 hover:underline">
                            View
                          </summary>
                          <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 font-mono text-[0.65rem] text-slate-700">
                            {JSON.stringify(metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Panel>

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="no-print flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
            <Link
              key={number}
              href={href({ action: actionFilter, page: number })}
              aria-current={number === page ? "page" : undefined}
              className={
                number === page
                  ? "grid h-9 w-9 place-items-center rounded-lg bg-leaf-700 text-sm font-bold text-white"
                  : "grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-leaf-400"
              }
            >
              {number}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="text-xs leading-relaxed text-slate-500">
        The log is global by default. Use the scope links above to narrow it to one edition, and the
        export page for a CSV of a single event.
      </p>
    </PageBody>
  );
}
