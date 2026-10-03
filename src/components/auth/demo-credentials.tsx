"use client";

import { useState } from "react";
import { FlaskConical, Copy, Check } from "lucide-react";

/**
 * Demo credentials panel.
 *
 * Only rendered when `DEMO_MODE=true`, which the env layer force-disables in
 * production. It exists so a reviewer can sign in without hunting through docs.
 */
export function DemoCredentials() {
  const [copied, setCopied] = useState<string | null>(null);

  // Named the tab each account needs. The two forms go to different Auth.js
  // providers, and each rejects the other's account type, so an organiser
  // e-mail typed into the student form looks like a wrong password.
  const accounts: Array<{
    role: "Organiser" | "Student";
    email: string;
    password: string;
    note: string;
  }> = [
    {
      role: "Organiser",
      email: "admin@helpingstation.deu",
      password: "ChangeMe!2024",
      note: "Full admin dashboard: participants, eligibility, draw console, audit log. Use the Organiser tab on the sign-in form.",
    },
    {
      role: "Student",
      email: "student@deu.ac.kr",
      password: "ChangeMe!2024",
      note: "A single participant's view of their own registration. Use the Student tab.",
    },
  ];

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5">
      <p className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        Demo accounts
      </p>
      <p className="mt-1 text-xs text-amber-800">
        These accounts exist only in demo mode and are disabled automatically in production.
      </p>
      <ul className="mt-4 space-y-3">
        {accounts.map((account) => {
          const value = `${account.email} / ${account.password}`;
          return (
            <li key={account.email} className="rounded-xl bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-leaf-800">
                  {account.role}
                </span>
                <button
                  type="button"
                  onClick={() => copy(value)}
                  className="inline-flex items-center gap-1 rounded-full border border-leaf-300 px-2.5 py-1 text-[0.7rem] font-bold text-leaf-700 transition hover:bg-leaf-50"
                >
                  {copied === value ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copied === value ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1.5 font-mono text-xs text-slate-700">{value}</p>
              <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">{account.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
