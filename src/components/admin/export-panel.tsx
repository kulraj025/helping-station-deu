"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, FileJson, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { FormAlert } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ExportScope {
  key: string;
  label: string;
  description: string;
  contains: string;
}

export const EXPORT_SCOPES: ExportScope[] = [
  {
    key: "participants",
    label: "Participants",
    description: "Every registration with attendance and eligibility status.",
    contains: "Entry number, name, department, statuses. Redacted by default.",
  },
  {
    key: "winners",
    label: "Winners",
    description: "Who won which prize, and whether it was collected.",
    contains: "Entry number, public name, prize, claim status.",
  },
  {
    key: "draw-report",
    label: "Draw report (JSON)",
    description:
      "The full draw record: frozen pool, hashes, revealed seed, winners, and a live integrity verification.",
    contains: "Nothing personal beyond the public display names.",
  },
  {
    key: "audit",
    label: "Audit log",
    description: "Up to 5,000 of the most recent sensitive actions for this event.",
    contains: "Action names, targets and metadata. No personal data by default.",
  },
];

/**
 * Export panel.
 *
 * Personal data is opt-in and clearly labelled. The point of the confirmation is
 * that an organiser exporting a file is taking it outside the system, so the
 * decision is deliberate and is recorded on the server either way.
 */
export function ExportPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [scope, setScope] = useState("participants");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [sensitive, setSensitive] = useState(false);

  const isReport = scope === "draw-report";
  const effectiveFormat = isReport ? "json" : format;
  const effectiveSensitive = isReport ? false : sensitive;

  const url = `/api/admin/export?event=${encodeURIComponent(eventId)}&scope=${scope}&format=${effectiveFormat}&includeSensitive=${effectiveSensitive ? "1" : "0"}`;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          What to export
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {EXPORT_SCOPES.map((option) => (
            <label
              key={option.key}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border p-4 transition",
                scope === option.key
                  ? "border-leaf-500 bg-leaf-50 ring-1 ring-leaf-400"
                  : "border-slate-200 bg-white hover:border-leaf-300",
              )}
            >
              <input
                type="radio"
                name="scope"
                value={option.key}
                checked={scope === option.key}
                onChange={() => setScope(option.key)}
                className="mt-0.5 h-4 w-4 accent-leaf-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-leaf-950">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  {option.description}
                </span>
                <span className="mt-1.5 block text-[0.7rem] text-slate-500">{option.contains}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          Format
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {(["csv", "json"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition",
                effectiveFormat === value
                  ? "border-leaf-500 bg-leaf-50 text-leaf-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-leaf-300",
                isReport && value === "csv" && "opacity-50",
              )}
            >
              <input
                type="radio"
                name="format"
                value={value}
                checked={effectiveFormat === value}
                disabled={isReport && value === "csv"}
                onChange={() => setFormat(value)}
                className="h-4 w-4 accent-leaf-600"
              />
              {value === "csv" ? (
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              ) : (
                <FileJson className="h-4 w-4" aria-hidden="true" />
              )}
              {value.toUpperCase()}
            </label>
          ))}
        </div>
        {isReport ? (
          <p className="mt-2 text-xs text-slate-500">
            The draw report is always JSON — it contains nested records, not a flat table.
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          Personal data
        </legend>
        {isReport ? (
          <FormAlert tone="info">
            The draw report contains no personal data beyond the public display names, so there is
            nothing to include.
          </FormAlert>
        ) : (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={sensitive}
                onChange={(event) => setSensitive(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-leaf-600"
              />
              <span>
                <span className="block text-sm font-extrabold text-leaf-950">
                  Include e-mail addresses, phone numbers and student IDs
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                  Off by default. Without it, student IDs are masked and contact fields are empty —
                  enough for a check-in desk list, useless for anything else.
                </span>
              </span>
            </label>

            {sensitive ? (
              <FormAlert tone="warning" title="This file contains personal data">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Store the file somewhere the rest of the organising team can reach, do not
                    forward it outside the team, and delete it once the event is finished. The
                    download is recorded in the audit log with your name against it.
                  </span>
                </span>
              </FormAlert>
            ) : (
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-600" aria-hidden="true" />
                The default export is safe to share with the wider team.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <ButtonLinkDownload href={url}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download for {eventName}
        </ButtonLinkDownload>
        <p className="text-xs text-slate-500">
          Every download is written to the audit log, including the personal-data decision.
        </p>
      </div>
    </div>
  );
}

/** A plain link styled as a button — a download is a navigation, not a mutation. */
function ButtonLinkDownload({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      rel="noopener"
      className="inline-flex h-12 items-center gap-2 rounded-full bg-leaf-700 px-7 text-sm font-extrabold text-white shadow-soft transition hover:bg-leaf-800"
    >
      {children}
    </Link>
  );
}
