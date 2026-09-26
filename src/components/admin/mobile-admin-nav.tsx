"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";

/** Slide-over navigation for phones — the sidebar is hidden below `lg`. */
export function MobileAdminNav({ eventId }: { eventId: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the admin menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-leaf-400"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close the admin menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] overflow-y-auto bg-leaf-950 px-4 py-5 shadow-glow"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="font-display text-sm font-extrabold text-white">Organiser area</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <AdminNav eventId={eventId} onNavigate={() => setOpen(false)} />
            <Link
              href="/"
              className="mt-5 flex items-center gap-2 border-t border-white/10 px-3 pt-5 text-xs font-semibold text-slate-300"
            >
              View public site
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
