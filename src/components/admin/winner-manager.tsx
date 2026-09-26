"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BellRing,
  Ban,
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert, Select, Textarea } from "@/components/ui/input";
import { ClaimBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/toast";
import {
  annotateWinnerAction,
  notifyWinnerAction,
  updateClaimStatusAction,
  revokeWinnerAction,
} from "@/server/actions/admin-winners";
import { initialWinnerState, type WinnerActionState } from "@/lib/action-state";
import { CLAIM_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ManagedWinner {
  id: string;
  entryNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  department: string;
  studentId: string;
  prizeName: string;
  prizeOrder: number;
  claimStatus: string;
  selectedAt: string;
  notifiedAt: string | null;
  claimedAt: string | null;
  revokedReason: string | null;
  publicDisplayConsent: boolean;
  contactConsent: boolean;
  claimInstructions: string | null;
  corrections: Array<{ id: string; type: string; reason: string; createdAt: string }>;
}

const CLAIM_LABELS: Record<string, string> = {
  PENDING: "Not notified yet",
  NOTIFIED: "Notified",
  CLAIMED: "Prize collected",
  UNCLAIMED: "Never collected",
};

function Submit({
  children,
  pendingLabel,
  tone = "primary",
  disabled,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: "primary" | "danger" | "outline";
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" && "bg-red-600 text-white hover:bg-red-700",
        tone === "outline" && "border border-slate-300 bg-white text-slate-700 hover:border-leaf-400",
        tone === "primary" && "bg-leaf-700 text-white hover:bg-leaf-800",
        className,
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Collapsible per-winner panel: claim tracking, notes, revocation. */
function WinnerRow({ winner, claimWindowDays }: { winner: ManagedWinner; claimWindowDays: number }) {
  const [open, setOpen] = useState(false);
  const [claimState, claimAction] = useActionState<WinnerActionState, FormData>(
    updateClaimStatusAction,
    initialWinnerState,
  );
  const [revokeState, revokeAction] = useActionState<WinnerActionState, FormData>(
    revokeWinnerAction,
    initialWinnerState,
  );
  const [noteState, noteAction] = useActionState<WinnerActionState, FormData>(
    annotateWinnerAction,
    initialWinnerState,
  );
  const [nextClaim, setNextClaim] = useState(winner.claimStatus);
  const [revokeReason, setRevokeReason] = useState("");

  const revoked = winner.claimStatus === "REVOKED";
  const selected = new Date(winner.selectedAt);
  const deadline = new Date(selected.getTime() + claimWindowDays * 24 * 60 * 60 * 1000);
  const overdue =
    winner.claimStatus === "PENDING" || winner.claimStatus === "NOTIFIED"
      ? Date.now() > deadline.getTime()
      : false;

  return (
    <li
      className={cn(
        "border-t border-slate-100 first:border-0",
        revoked && "bg-slate-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-300/60 text-xs font-extrabold text-leaf-900">
          {winner.prizeOrder}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-leaf-900">{winner.entryNumber}</span>
            <ClaimBadge status={winner.claimStatus} />
            {overdue ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-amber-800">
                Overdue
              </span>
            ) : null}
            {!winner.publicDisplayConsent ? (
              <span
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-slate-500"
                title="This participant asked not to be named publicly"
              >
                Name hidden
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-slate-700">
            <span className="font-semibold">{winner.fullName}</span>
            <span className="text-slate-400"> · {winner.department}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {winner.prizeName} · selected {formatDateTime(winner.selectedAt)}
          </span>
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {!revoked && winner.contactConsent ? (
            <form action={notifyWinnerAction}>
              <input type="hidden" name="winnerId" value={winner.id} />
              <Submit pendingLabel="Queuing…" tone="outline">
                <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                Notify
              </Submit>
            </form>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? "Close" : "Manage"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {revoked && winner.revokedReason ? (
        <p className="mx-5 mb-3 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-800">
          <strong className="font-extrabold">Revoked:</strong> {winner.revokedReason}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-5 border-t border-slate-100 bg-canvas/60 px-5 py-4">
          {/* claim tracking */}
          <form action={claimAction} className="space-y-2.5">
            <input type="hidden" name="winnerId" value={winner.id} />
            <input type="hidden" name="claimStatus" value={nextClaim} />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Claim status</p>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={nextClaim}
                onChange={(event) => setNextClaim(event.target.value)}
                aria-label={`Claim status for ${winner.entryNumber}`}
                className="w-52"
              >
                {CLAIM_STATUSES.filter((status) => status !== "REVOKED").map((status) => (
                  <option key={status} value={status}>
                    {CLAIM_LABELS[status] ?? status}
                  </option>
                ))}
              </Select>
              <Submit
                pendingLabel="Saving…"
                disabled={nextClaim === winner.claimStatus || revoked}
              >
                <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Update
              </Submit>
            </div>
            {claimState.status === "error" ? (
              <p className="text-xs font-semibold text-red-600">{claimState.message}</p>
            ) : null}
            {claimState.status === "success" ? (
              <p className="text-xs font-semibold text-leaf-700">{claimState.message}</p>
            ) : null}
          </form>

          {/* contact details — deliberately a second click */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Contact (not published)
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-slate-700">
                <span className="block text-[0.65rem] uppercase text-slate-400">E-mail</span>
                <span className="break-all">{winner.email}</span>
              </p>
              <p className="text-sm text-slate-700">
                <span className="block text-[0.65rem] uppercase text-slate-400">Phone</span>
                {winner.phone ?? "—"}
              </p>
              <p className="text-sm text-slate-700">
                <span className="block text-[0.65rem] uppercase text-slate-400">Student ID</span>
                <span className="font-mono">{winner.studentId}</span>
              </p>
              <p className="text-sm text-slate-700">
                <span className="block text-[0.65rem] uppercase text-slate-400">Claim by</span>
                {formatDateTime(deadline)}
              </p>
            </div>
            <div className="mt-2.5">
              <CopyButton value={`${winner.entryNumber} · ${winner.fullName}`} label="Copy for the desk list" />
            </div>
            {!winner.contactConsent ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                No contact consent recorded, so notifying is disabled.
              </p>
            ) : null}
          </div>

          {winner.claimInstructions ? (
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <strong className="font-extrabold">Claim instructions:</strong> {winner.claimInstructions}
            </p>
          ) : null}

          {/* append a note */}
          <form action={noteAction} className="space-y-2">
            <input type="hidden" name="winnerId" value={winner.id} />
            <label
              htmlFor={`note-${winner.id}`}
              className="block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Append a note to the draw history
            </label>
            <Textarea
              id={`note-${winner.id}`}
              name="details"
              rows={2}
              maxLength={500}
              placeholder="e.g. Winner e-mailed on 14 June, prize held at the desk"
            />
            <Submit pendingLabel="Recording…">
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Append note
            </Submit>
            {noteState.status === "error" ? (
              <p className="text-xs font-semibold text-red-600">{noteState.message}</p>
            ) : null}
            {noteState.status === "success" ? (
              <p className="text-xs font-semibold text-leaf-700">{noteState.message}</p>
            ) : null}
          </form>

          {/* revoke */}
          {!revoked ? (
            <details className="rounded-xl border border-red-200 bg-red-50/50 p-3.5">
              <summary className="cursor-pointer list-none text-xs font-extrabold uppercase tracking-wide text-red-700">
                <span className="inline-flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  Revoke this prize (permanent, recorded)
                </span>
              </summary>
              <form action={revokeAction} className="mt-3 space-y-2.5">
                <input type="hidden" name="winnerId" value={winner.id} />
                <label htmlFor={`reason-${winner.id}`} className="block text-xs font-bold text-red-800">
                  Why is this prize being revoked?
                </label>
                <Textarea
                  id={`reason-${winner.id}`}
                  name="reason"
                  rows={2}
                  maxLength={500}
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  placeholder="e.g. Winner did not take part in the activity after all"
                />
                <p className="text-xs leading-relaxed text-red-800">
                  The original winner record is kept exactly as the draw produced it. Revoking appends
                  a correction explaining the difference, and the prize is offered to the next
                  eligible entry from the same frozen pool.
                </p>
                {revokeState.status === "error" ? (
                  <FormAlert tone="error">{revokeState.message}</FormAlert>
                ) : null}
                {revokeState.status === "success" ? (
                  <FormAlert tone="success" title="Revoked">
                    {revokeState.message}
                  </FormAlert>
                ) : null}
                <Submit pendingLabel="Revoking…" tone="danger" disabled={revokeReason.trim().length < 10}>
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  Revoke the prize
                </Submit>
              </form>
            </details>
          ) : null}

          {/* correction history */}
          {winner.corrections.length > 0 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Corrections on this result
              </p>
              <ul className="mt-2 space-y-2">
                {winner.corrections.map((correction) => (
                  <li key={correction.id} className="rounded-xl bg-white p-3 text-xs ring-1 ring-slate-200">
                    <span className="font-mono text-[0.65rem] font-bold text-slate-500">
                      {correction.type}
                    </span>
                    <span className="ml-2 text-slate-700">{correction.reason}</span>
                    <span className="mt-1 block text-slate-400">
                      {formatDateTime(correction.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Winner management list: claims, notes and append-only corrections. */
export function WinnerManager({
  winners,
  claimWindowDays,
}: {
  winners: ManagedWinner[];
  claimWindowDays: number;
}) {
  if (winners.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        No winners recorded for this event yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {winners.map((winner) => (
        <WinnerRow key={winner.id} winner={winner} claimWindowDays={claimWindowDays} />
      ))}
    </ul>
  );
}
