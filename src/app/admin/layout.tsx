import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Leaf, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAdminScope } from "@/server/admin/scope";
import { AdminNav } from "@/components/admin/admin-nav";
import { EventSwitcher } from "@/components/admin/event-switcher";
import { MobileAdminNav } from "@/components/admin/mobile-admin-nav";
import { DemoBanner } from "@/components/site/demo-banner";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "Organiser area",
    template: "%s · Organiser area",
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin shell.
 *
 * Auth is enforced here, once, for every admin page. The whole area is
 * `noindex`, and it renders a demo banner whenever demo mode is on so a
 * screenshot can never be mistaken for a real event.
 */
export default async function AdminLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin("/admin");
  const scope = await getAdminScope(params, admin);

  // A first-time organiser with no events at all needs the create screen, not
  // an empty dashboard they cannot act from.
  const hasEvents = scope.events.length > 0;
  if (!hasEvents) {
    // Still render the shell so /admin/events/new works.
  } else if (!scope.event) {
    redirect("/admin/events?error=not-found");
  }

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[17rem_1fr]">
      {/* ---------------- sidebar (desktop) ---------------- */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-leaf-950 px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-leaf-600 text-white">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-display text-sm font-extrabold text-white">
              Helping Station
            </span>
            <span className="block text-[0.7rem] font-semibold uppercase tracking-widest text-leaf-300">
              Organiser area
            </span>
          </span>
        </Link>

        <EventSwitcher
          events={scope.events}
          currentId={scope.event?.id ?? null}
        />

        <div className="mt-5 flex-1">
          <AdminNav eventId={scope.event?.id ?? null} />
        </div>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <p className="px-2 text-xs text-slate-400">
            Signed in as{" "}
            <span className="font-bold text-slate-200">{admin.name}</span>
            <span className="block text-slate-500">{admin.email}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View public site
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ---------------- mobile header ---------------- */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <MobileAdminNav eventId={scope.event?.id ?? null} />
        <Link href="/admin" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-700 text-white">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-extrabold text-leaf-950">Organiser area</span>
        </Link>
      </div>

      {/* ---------------- content ---------------- */}
      <div className="min-w-0">
        {env.demoMode ? <DemoBanner compact /> : null}
        {!hasEvents ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:px-8">
            <strong className="font-extrabold">No events yet.</strong> Create your first event to
            start taking registrations.
          </div>
        ) : null}
        {scope.notFound ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 lg:px-8">
            That event could not be found.{" "}
            <Link href="/admin/events" className="font-bold underline underline-offset-2">
              Pick one from the list
            </Link>
            .
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
