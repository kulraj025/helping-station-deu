"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  CalendarRange,
  FileDown,
  Gift,
  ListChecks,
  ScrollText,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
  description: string;
}

/** Admin navigation. `/admin` is the dashboard; the rest take an event scope. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, description: "At a glance" },
  { href: "/admin/events", label: "Events", icon: CalendarRange, description: "Create & edit" },
  { href: "/admin/participants", label: "Participants", icon: Users, description: "Registrations" },
  { href: "/admin/eligibility", label: "Eligibility", icon: ListChecks, description: "Who can win" },
  { href: "/admin/prizes", label: "Prizes", icon: Gift, description: "Prize table" },
  { href: "/admin/draw", label: "Lucky draw", icon: Shuffle, description: "Lock, draw, verify" },
  { href: "/admin/winners", label: "Winners", icon: Award, description: "Claims & corrections" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, description: "Every action" },
  { href: "/admin/export", label: "Export", icon: FileDown, description: "CSV & reports" },
  { href: "/admin/controls", label: "Site controls", icon: SlidersHorizontal, description: "Close sections" },
  { href: "/admin/settings", label: "Settings", icon: Settings2, description: "Configuration" },
];

/** Adds the current event scope to every link. */
export function navHref(href: string, eventId: string | null): string {
  if (href === "/admin") return "/admin";
  return eventId ? `${href}?event=${encodeURIComponent(eventId)}` : href;
}

export function AdminNav({
  eventId,
  onNavigate,
}: {
  eventId: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const href = navHref(item.href, eventId);
        // `/admin` must match exactly, otherwise every child page would light up.
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
              active
                ? "bg-leaf-600 text-white shadow-soft"
                : "text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{item.label}</span>
              <span
                className={cn(
                  "block truncate text-xs",
                  active ? "text-leaf-100" : "text-slate-400",
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
