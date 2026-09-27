import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SITE_SECTIONS } from "@/lib/site-settings";
import { getSiteSettings } from "@/server/services/site-settings-service";
import { PageBody, PageHeader, Panel } from "@/components/admin/page-parts";
import {
  DeleteAllParticipants,
  SectionLinks,
  SectionSwitches,
  UserList,
  type UserRow,
} from "@/components/admin/controls-panel";

export const metadata: Metadata = { title: "Site controls" };
export const dynamic = "force-dynamic";

/**
 * The one screen for "change the running site without a deploy".
 *
 * Two things live here because they are the two things an organiser needs on a
 * phone at an event: close a public section, and remove an account that was
 * created by mistake. Both were previously impossible without a terminal.
 */
export default async function ControlsPage() {
  const admin = await requireAdmin("/admin/controls");

  const [settings, users] = await Promise.all([
    getSiteSettings(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { registrations: true } },
      },
    }),
  ]);

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
    registrations: user._count.registrations,
  }));

  const participantCount = rows.filter((row) => row.role !== "ADMIN").length;

  const sectionLinks = SITE_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    path: section.path,
    open: settings.siteOpen && settings[section.key],
  }));

  return (
    <PageBody>
      <PageHeader
        title="Site controls"
        description="Close a public section or remove an account. Changes take effect immediately — nothing here needs a deploy."
      />

      <Panel
        title="Public sections"
        description="Each switch opens or closes one part of the public site. A closed section shows visitors a short 'closed' page instead."
      >
        <div className="space-y-5">
          <SectionSwitches settings={settings} />
          <div className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Right now
            </p>
            <SectionLinks sections={sectionLinks} />
          </div>
        </div>
      </Panel>

      <Panel
        title="Accounts"
        description="Every account that exists, newest first. Deleting a participant also removes their registrations."
        bodyClassName="p-5"
      >
        <UserList users={rows} currentAdminId={admin.id} />
      </Panel>

      <Panel
        title="Delete all participants"
        description="For clearing out test or duplicate sign-ups in one go."
        tone="danger"
      >
        <DeleteAllParticipants count={participantCount} />
      </Panel>
    </PageBody>
  );
}
