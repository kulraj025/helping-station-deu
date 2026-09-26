"use client";

import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { useState } from "react";
import { EventStatusBadge } from "@/components/ui/badge";
import { formatEventDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SwitcherEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  /** Passed to `Intl` formatters, which accept `Date` or an ISO string. */
  startAt: string | Date;
  isDemo: boolean;
}

/**
 * Event scope switcher.
 *
 * Admin pages all operate on one event; this is how the organiser changes which
 * one. It navigates rather than using a form so the whole URL stays shareable.
 */
export function EventSwitcher({
  events,
  currentId,
  dark = false,
}: {
  events: SwitcherEvent[];
  currentId: string | null;
  dark?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = events.find((event) => event.id === currentId) ?? null;

  if (events.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
          dark
            ? "bg-white/10 text-white hover:bg-white/15"
            : "border border-slate-200 bg-white hover:border-leaf-400",
        )}
      >
        <CalendarRange
          className={cn("h-4 w-4 shrink-0", dark ? "text-leaf-300" : "text-leaf-600")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[0.65rem] font-bold uppercase tracking-widest",
              dark ? "text-leaf-300" : "text-slate-500",
            )}
          >
            Event in scope
          </span>
          <span className="block truncate text-sm font-bold">
            {current ? current.name : "Select an event…"}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <>
          {/* click-away layer */}
          <button
            type="button"
            aria-label="Close the event list"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Choose an event"
            className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-glow"
          >
            {events.map((event) => {
              const selected = event.id === currentId;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setOpen(false);
                      const params = new URLSearchParams(window.location.search);
                      params.set("event", event.id);
                      router.push(`/admin?${params.toString()}`);
                    }}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition",
                      selected ? "bg-leaf-50 ring-1 ring-leaf-300" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-leaf-950">
                        {event.name}
                      </span>
                      {event.isDemo ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-amber-800">
                          Demo
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <EventStatusBadge status={event.status} />
                      <span className="text-xs text-slate-500">
                        {formatEventDateShort(event.startAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
