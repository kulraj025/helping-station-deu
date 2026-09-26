"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Fingerprint,
  Lock,
  MonitorUp,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  XCircle,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAlert, Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/toast";
import { Panel } from "@/components/admin/page-parts";
import {
  lockPoolAction,
  resetTestDrawAction,
  runDrawAction,
  verifyDrawAction,
} from "@/server/actions/admin-draw";
import { initialDrawState, type DrawActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export interface ConsoleState {
  status: "NOT_STARTED" | "LOCKED" | "IN_PROGRESS" | "COMPLETED";
  eligibleCount: number;
  totalSlots: number;
  prizes: Array<{ name: string; quantity: number; order: number }>;
  lockedAt: string | null;
  poolHash: string | null;
  commitHash: string | null;
  entropy: string | null;
  drawId: string | null;
  isDemo: boolean;
  publicDrawScreen: boolean;
  winners: Array<{ entryNumber: string; prizeName: string; prizeOrder: number }>;
}

function ActionButton({
  children,
  pendingLabel,
  tone = "primary",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: "primary" | "danger";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-leaf-700 hover:bg-leaf-800",
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Typing the code back is the guard against a reflexive click. */
function ConfirmField({
  eventId,
  expected,
  label,
  help,
  mode,
}: {
  eventId: string;
  expected: string;
  label: string;
  help: string;
  mode: "lock" | "run";
}) {
  const [value, setValue] = useState("");
  const [state, formAction] = useActionState<DrawActionState, FormData>(
    mode === "run" ? runDrawAction : lockPoolAction,
    initialDrawState,
  );
  const matches = value.trim().toUpperCase() === expected;
  const isLock = mode === "lock";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <p className="text-sm leading-relaxed text-slate-700">{help}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={`confirm-${mode}-${eventId}`}
            className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Type <span className="font-mono text-sm text-slate-800">{expected}</span> to confirm
          </label>
          <Input
            id={`confirm-${mode}-${eventId}`}
            name="code"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={expected}
            className={cn(
              "w-44 font-mono uppercase tracking-[0.3em]",
              value !== "" && !matches && "border-red-400",
              matches && "border-leaf-500",
            )}
          />
        </div>
        <ActionButton pendingLabel={isLock ? "Locking…" : "Running…"} disabled={!matches}>
          {isLock ? (
            <>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Lock the pool
            </>
          ) : (
            <>
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              {label}
            </>
          )}
        </ActionButton>
      </div>
      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}
      {state.status === "success" ? (
        <FormAlert tone="success" title="Done">
          {state.message}
        </FormAlert>
      ) : null}
      {state.status === "success" && state.winners && state.winners.length > 0 ? (
        <ul className="space-y-1.5">
          {state.winners.map((winner) => (
            <li
              key={winner.entryNumber}
              className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-2.5"
            >
              <span aria-hidden="true">🎉</span>
              <span className="font-mono text-sm font-bold text-leaf-900">
                {winner.entryNumber}
              </span>
              <span className="text-sm text-slate-600">{winner.prizeName}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {state.verification ? (
        <VerificationReport verification={state.verification} />
      ) : null}
    </form>
  );
}

function VerificationReport({
  verification,
}: {
  verification: NonNullable<DrawActionState["verification"]>;
}) {
  const ok =
    verification.commitMatches && verification.poolHashMatches && verification.winnersMatch;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        ok ? "border-leaf-300 bg-leaf-50" : "border-red-300 bg-red-50",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 font-extrabold",
          ok ? "text-leaf-800" : "text-red-800",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <XCircle className="h-5 w-5" aria-hidden="true" />
        )}
        {ok ? "Verification passed" : "Verification failed"}
      </p>
      <ul className="mt-2.5 space-y-1 text-sm">
        {[
          ["Randomness commitment", verification.commitMatches],
          ["Participant pool fingerprint", verification.poolHashMatches],
          ["Winners reproduce from the published seed", verification.winnersMatch],
        ].map(([label, passed]) => (
          <li
            key={String(label)}
            className={cn("flex items-center gap-2", passed ? "text-leaf-800" : "text-red-800")}
          >
            {passed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {String(label)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The draw console.
 *
 * Three states, in order: nothing has happened, the pool is locked, the draw is
 * done. Each state exposes exactly one irreversible action, and the wording
 * says plainly what cannot be undone.
 */
export function DrawConsole({
  state: initial,
  expectedCode,
  eventId,
  registrationOpen,
}: {
  state: ConsoleState;
  expectedCode: string;
  eventId: string;
  registrationOpen: boolean;
}) {
  const [verifyState, verifyAction] = useActionState<DrawActionState, FormData>(
    verifyDrawAction,
    initialDrawState,
  );

  // Reveal newly-awarded winners from a run without a full page reload.
  useEffect(() => {
    if (verifyState.status === "success") {
      // Verification does not need a refresh; the draw result does.
    }
  }, [verifyState.status]);

  const locked = initial.status === "LOCKED" || initial.status === "IN_PROGRESS";
  const completed = initial.status === "COMPLETED";
  const shortfall = Math.max(0, initial.totalSlots - initial.winners.length);

  return (
    <div className="space-y-6">
      {/* ---------------- step 1: lock ---------------- */}
      {!locked ? (
        <Panel tone={initial.eligibleCount === 0 ? "warning" : "default"}>
          <h2 className="font-display text-lg font-extrabold text-leaf-950">
            Step 1 — lock the participant pool
          </h2>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">
            <p>
              Locking copies{" "}
              <strong className="text-leaf-900">{initial.eligibleCount}</strong> eligible entry
              number{initial.eligibleCount === 1 ? "" : "s"} into an immutable snapshot and stores a
              SHA-256 fingerprint of it. After this, nobody can join or leave the draw — not even you.
            </p>
            {registrationOpen ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Registration is still open, so new participants could arrive after you lock. Set
                  the event status to REGISTRATION_CLOSED first — the software will refuse to lock
                  while it is open.
                </span>
              </p>
            ) : null}
            {initial.totalSlots === 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>No prizes are configured, so there is nothing to draw. Add prizes first.</span>
              </p>
            ) : null}
            {initial.eligibleCount === 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 font-semibold text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  No eligible participants. Confirm attendance and eligibility before locking.
                </span>
              </p>
            ) : null}
          </div>

          {initial.totalSlots > 0 && initial.eligibleCount > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <ConfirmField
                eventId={eventId}
                expected={expectedCode}
                mode="lock"
                label="Lock the pool"
                help="Locking is permanent. If you lock too early you cannot add the person you forgot, and you will have to record a correction afterwards."
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {/* ---------------- step 2: run ---------------- */}
      {locked ? (
        <Panel tone="warning" title="Step 2 — run the draw">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  Frozen entries
                </p>
                <p className="mt-0.5 font-display text-xl font-extrabold text-leaf-950">
                  {initial.eligibleCount}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  Prize slots
                </p>
                <p className="mt-0.5 font-display text-xl font-extrabold text-leaf-950">
                  {initial.totalSlots}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  Locked at
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-700">
                  {initial.lockedAt ? new Date(initial.lockedAt).toUTCString() : "—"}
                </p>
              </div>
            </div>

            {initial.poolHash ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                  Pool fingerprint (SHA-256)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-700">
                    {initial.poolHash}
                  </code>
                  <CopyButton value={initial.poolHash} label="Copy hash" />
                </div>
              </div>
            ) : null}

            <FormAlert tone="warning" title="This cannot be undone">
              Running the draw selects winners from the frozen pool using the operating system&apos;s
              cryptographic random number generator. The result is final. If it is wrong afterwards,
              the only fix is an appended correction — there is no re-roll.
            </FormAlert>

            <ConfirmField
              eventId={eventId}
              expected={expectedCode}
              mode="run"
              label="Run the draw now"
              help="You have closed registration, so the frozen pool is final. Run the draw when the event is over and attendance is confirmed."
            />
          </div>
        </Panel>
      ) : null}

      {/* ---------------- step 3: verify ---------------- */}
      {completed ? (
        <Panel tone="success" title="Step 3 — the result is permanent">
          <div className="space-y-5">
            <div className="rounded-2xl border-2 border-leaf-300 bg-leaf-50 p-5">
              <p className="flex items-center gap-2 font-extrabold text-leaf-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                Completed and verifiable
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-leaf-800">
                {initial.winners.length} winner{initial.winners.length === 1 ? "" : "s"} awarded.
                {shortfall > 0
                  ? ` ${shortfall} slot(s) had no eligible entry left and went unclaimed.`
                  : " Every slot was filled."}{" "}
                The draw cannot be re-run.
              </p>
            </div>

            {initial.winners.length > 0 ? (
              <ol className="space-y-2">
                {initial.winners.map((winner) => (
                  <li
                    key={winner.entryNumber}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-200 bg-amber-50 px-4 py-3"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-300/60 text-sm font-extrabold text-leaf-900">
                      {winner.prizeOrder}
                    </span>
                    <span className="font-mono text-sm font-bold text-leaf-900">
                      {winner.entryNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {winner.prizeName}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}

            {/* fingerprints */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Pool fingerprint", value: initial.poolHash },
                { label: "Randomness commitment", value: initial.commitHash },
                { label: "Revealed seed", value: initial.entropy },
              ].map((item) => (
                <div key={item.label}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </p>
                  {item.value ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 p-2.5 font-mono text-[0.7rem] text-slate-700">
                        {item.value}
                      </code>
                      <CopyButton value={item.value} label="Copy" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Not recorded.</p>
                  )}
                </div>
              ))}
            </div>

            {/* verify */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm leading-relaxed text-slate-700">
                Verification replays the published algorithm over the frozen pool and the revealed
                seed, and checks it reproduces exactly the recorded winners. It is safe to run as
                often as you like.
              </p>
              <form action={verifyAction} className="mt-3 space-y-3">
                <input type="hidden" name="drawId" value={initial.drawId ?? ""} />
                <Button type="submit" variant="secondary" size="sm">
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Verify integrity now
                </Button>
                {verifyState.status === "success" && verifyState.verification ? (
                  <VerificationReport verification={verifyState.verification} />
                ) : null}
                {verifyState.status === "success" && !verifyState.verification ? (
                  <FormAlert tone="success">{verifyState.message}</FormAlert>
                ) : null}
                {verifyState.status === "error" ? (
                  <FormAlert tone="error">{verifyState.message}</FormAlert>
                ) : null}
              </form>
            </div>

            {/* display mode */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700">Show the room</p>
              <p className="mt-0.5 text-xs text-slate-500">
                The projector view is a separate, chrome-free page that self-updates. Open it on the
                hall screen and leave it.
              </p>
              <div className="mt-2.5">
                <ButtonLink
                  href={`/draw/display?event=${eventId}`}
                  variant="secondary"
                  size="sm"
                  target="_blank"
                >
                  <MonitorUp className="h-4 w-4" aria-hidden="true" />
                  Open the projector view
                </ButtonLink>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* ---------------- rehearsal reset (demo only) ---------------- */}
      {initial.isDemo ? (
        <Panel tone="warning" title="Rehearsal reset">
          <p className="text-sm leading-relaxed text-slate-700">
            This is a demo event, so the draw can be cleared and rehearsed again. Deleting it
            removes the snapshot, the winners and the recorded randomness — everything the audit log
            still refers to, which is why this is offered for demo data only.
          </p>
          <form action={resetTestDrawAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <div>
              <label
                htmlFor="reset-code"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Type <span className="font-mono text-sm text-slate-800">{expectedCode}</span> to reset
              </label>
              <Input
                id="reset-code"
                name="code"
                placeholder={expectedCode}
                autoComplete="off"
                spellCheck={false}
                className="w-44 font-mono uppercase tracking-[0.3em]"
              />
            </div>
            <ActionButton pendingLabel="Resetting…" tone="danger">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear the demo draw
            </ActionButton>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
