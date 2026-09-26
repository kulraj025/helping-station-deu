import type { Metadata } from "next";
import { FileDown, Lock, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAdminScope } from "@/server/admin/scope";
import { prisma } from "@/lib/prisma";
import { PageBody, PageHeader, Panel, StatTile } from "@/components/admin/page-parts";
import { ExportPanel } from "@/components/admin/export-panel";
import { FormAlert } from "@/components/ui/input";

export const metadata: Metadata = { title: "Export" };
export const dynamic = "force-dynamic";

export default async function AdminExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin/export");
  const scope = await getAdminScope(params, admin);
  const event = scope.event;

  if (!event) {
    return (
      <PageBody>
        <Panel>
          <p className="text-sm text-slate-600">Select an event to export from.</p>
        </Panel>
      </PageBody>
    );
  }

  const [registrations, winners, auditEntries] = await Promise.all([
    prisma.registration.count({ where: { eventId: event.id } }),
    prisma.winner.count({ where: { eventId: event.id } }),
    prisma.auditLog.count({ where: { eventId: event.id } }),
  ]);

  return (
    <PageBody>
      <PageHeader
        title="Export"
        description="Download the data as CSV or JSON. Personal data is off unless you turn it on, and every download is logged."
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
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Registrations" value={registrations} />
        <StatTile label="Winners" value={winners} tone="gold" />
        <StatTile label="Audit entries" value={auditEntries} tone="azure" />
      </div>

      <Panel
        title="Build an export"
        description="Nothing is generated until you download it, and the download itself is recorded."
      >
        <ExportPanel eventId={event.id} eventName={event.name} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel tone="success" title="What leaves the system">
          <ul className="space-y-2.5 text-sm leading-relaxed text-leaf-900">
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                With personal data off, a file contains entry numbers, names, departments and
                statuses. Student IDs are masked and contact fields are empty.
              </span>
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                The draw report is safe to publish: it carries hashes and public display names, not
                contact details.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Audit entries for this event are included in the audit export, including any earlier
                export — so the log of who took what is itself auditable.
              </span>
            </li>
          </ul>
        </Panel>

        <Panel title="Housekeeping">
          <p className="text-sm leading-relaxed text-slate-700">
            Personal data is only needed for the claim desk. Once every prize has been collected,
            delete the file you downloaded. Retention guidance for the records still in the database
            is in the privacy page.
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <FileDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              There is no automatic deletion job in this build. An organiser or a system
              administrator has to remove records deliberately, which is deliberate rather than
              accidental.
            </span>
          </p>
        </Panel>
      </div>

      {event.isDemo ? (
        <FormAlert tone="info" title="Demo event">
          This file contains fictional test data. Do not send it to anybody as if it were a real
          result.
        </FormAlert>
      ) : null}
    </PageBody>
  );
}
