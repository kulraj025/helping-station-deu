"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Fingerprint,
  Lock,
  MonitorUp,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { CopyButton } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Mirrors `PublicDrawState` from the draw service (no personal data). */
export interface DrawState {
  event: { id: string; name: string; slug: string; isDemo: boolean };
  status: "NOT_STARTED" | "LOCKED" | "IN_PROGRESS" | "COMPLETED";
  officialDraw?: boolean;
  eligibleCount: number;
  totalSlots: number;
  prizes: Array<{ name: string; quantity: number; order: number }>;
  lockedAt: string | null;
  poolHash: string | null;
  results: Array<{
    id: string;
    entryNumber: string;
    displayName: string | null;
    department: string | null;
    prizeName: string;
    prizeOrder: number;
    selectedAt: string;
  }>;
  integrity: { commitHash: string; poolHash: string; entropy: string | null } | null;
  visibility: { drawScreen: boolean; winners: boolean };
  updatedAt: string;
}

type Phase = "waiting" | "spinning" | "revealing" | "done";

const STATUS_COPY: Record<DrawState["status"], { title: string; body: string }> = {
  NOT_STARTED: {
    title: "The draw has not started yet",
    body: "The organiser will close registration and lock the participant list first. Keep this page open.",
  },
  LOCKED: {
    title: "The participant list is locked",
    body: "Every eligible entry number is now frozen and fingerprinted. The draw is about to begin.",
  },
  IN_PROGRESS: {
    title: "Selecting…",
    body: "The server is running the secure random selection right now.",
  },
  COMPLETED: {
    title: "Draw complete",
    body: "Here are the results. You can verify how they were produced below.",
  },
};

/** Deterministic confetti (no hydration mismatch, no Math.random in render). */
function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        // Cheap deterministic pseudo-random from the index.
        const a = (index * 9301 + 49297) % 233280;
        const r1 = a / 233280;
        const b = (index * 4096 + 12345) % 65536;
        const r2 = b / 65536;
        const colors = ["#22c55e", "#38bdf8", "#fbbf24", "#a78bfa", "#f472b6", "#34d399"];
        return {
          left: r1 * 100,
          delay: r2 * 1.4,
          duration: 2.6 + r2 * 2.4,
          drift: (r1 - 0.5) * 240,
          spin: 360 + r1 * 1080,
          color: colors[index % colors.length] as string,
          size: 6 + Math.round(r2 * 8),
        };
      }),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              width: piece.size,
              height: piece.size * 1.4,
              "--duration": `${piece.duration}s`,
              "--delay": `${piece.delay}s`,
              "--drift": `${piece.drift}px`,
              "--spin": `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function shortHash(hash: string | null | undefined, length = 12): string {
  if (!hash) return "—";
  return hash.length <= length ? hash : `${hash.slice(0, length)}…`;
}

/**
 * The live draw screen.
 *
 * The client never selects anybody: it polls the public draw state and only
 * *reveals* a result that the server has already committed and recorded. That is
 * why the animation cannot be rigged by a client, a browser extension, or by
 * reloading the page.
 */
export function DrawStage({
  initialState,
  mode = "page",
}: {
  initialState: DrawState | null;
  mode?: "page" | "display";
}) {
  const [state, setState] = useState<DrawState | null>(initialState);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const seenCompletion = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!initialState) return;
    try {
      const response = await fetch(
        `/api/public/draw-state?event=${encodeURIComponent(initialState.event.slug)}`,
        { cache: "no-store", signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as DrawState;
      setState(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("Lost connection to the draw. Retrying…");
      }
    }
  }, [initialState]);

  // Poll until the draw is complete, then stop.
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      if (seenCompletion.current) return;
      void load(controller.signal);
    }, 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  // Spin, then reveal the already-decided winners one by one.
  useEffect(() => {
    if (!state || state.status !== "COMPLETED" || seenCompletion.current) return;
    seenCompletion.current = true;
    const total = state.results.length;
    if (total === 0) {
      setPhase("done");
      return;
    }
    setPhase("spinning");
    const spinMs = reducedMotion.current ? 200 : 2600;
    const spinTimer = window.setTimeout(() => setPhase("revealing"), spinMs);
    const stepMs = reducedMotion.current ? 120 : 950;
    let index = 1;
    const stepTimer = window.setInterval(() => {
      index += 1;
      setRevealed(index);
      if (index >= total) {
        window.clearInterval(stepTimer);
        window.setTimeout(() => setPhase("done"), 500);
      }
    }, stepMs);
    return () => {
      window.clearTimeout(spinTimer);
      window.clearInterval(stepTimer);
    };
  }, [state]);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-slate-500">Loading the draw…</p>
      </div>
    );
  }

  const copy = STATUS_COPY[state.status];
  const visibleResults = phase === "done" || phase === "revealing" ? state.results.slice(0, revealed) : [];
  const showConfetti = phase === "done" && state.results.length > 0;

  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        mode === "display" ? "max-w-6xl" : "max-w-4xl",
      )}
    >
      {showConfetti ? <Confetti /> : null}

      <div className="text-center">
        {state.event.isDemo ? (
          <Badge tone="gold" className="mb-4">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Demo data
          </Badge>
        ) : null}

        <h1
          className={cn(
            "font-display font-extrabold leading-tight text-leaf-950",
            mode === "display" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl",
          )}
        >
          {state.event.name}
        </h1>
        <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-leaf-600">
          Lucky draw
        </p>
      </div>

      {/* stat strip */}
      <div
        className={cn(
          "mt-7 grid gap-3",
          mode === "display" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {[
          { label: "Eligible entries", value: state.eligibleCount, icon: Users },
          { label: "Prizes", value: state.totalSlots, icon: Trophy },
          { label: "Prizes defined", value: state.prizes.length, icon: Sparkles },
          {
            label: "Pool status",
            value: state.status === "COMPLETED" ? "Frozen" : state.status === "LOCKED" ? "Locked" : "Open",
            icon: Lock,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-soft"
            >
              <Icon className="mx-auto h-5 w-5 text-leaf-600" aria-hidden="true" />
              <p className="mt-1.5 font-display text-2xl font-extrabold text-leaf-900">
                {item.value}
              </p>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* stage */}
      <div
        className={cn(
          "relative mt-6 overflow-hidden rounded-3xl border-2 shadow-glow",
          phase === "spinning" ? "border-gold-300" : "border-leaf-200",
          "bg-white",
        )}
      >
        <div
          className={cn(
            "px-5 py-10 text-center sm:px-10",
            mode === "display" && "py-16",
            phase === "spinning" ? "bg-gradient-to-br from-amber-50 to-gold-300/30" : "bg-gradient-to-br from-leaf-50 to-azure-50",
          )}
        >
          {phase === "spinning" ? (
            <div aria-live="assertive">
              <p className="font-display text-3xl font-extrabold text-amber-700 sm:text-5xl">
                Selecting winners…
              </p>
              <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
                {state.results.length > 0 ? (
                  state.results.map((result) => (
                    <span
                      key={result.id}
                      className="animate-pulse rounded-full bg-white px-4 py-2 font-mono text-sm font-bold text-leaf-800 shadow-soft"
                    >
                      ••••••
                    </span>
                  ))
                ) : (
                  <Spinner className="h-6 w-6" />
                )}
              </div>
            </div>
          ) : state.status === "COMPLETED" && visibleResults.length === 0 ? (
            <div>
              <CheckCircle2 className="mx-auto h-12 w-12 text-leaf-600" aria-hidden="true" />
              <p className="mt-3 font-display text-2xl font-extrabold text-leaf-900">
                No winners were selected
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                There were not enough eligible entries to fill every prize slot. The organiser has
                been notified.
              </p>
            </div>
          ) : (
            <div aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                {phase === "done" ? "Result" : "And the winner is…"}
              </p>
              <ul className="mx-auto mt-5 grid max-w-3xl gap-3">
                {visibleResults.map((result) => (
                  <li
                    key={result.id}
                    className="animate-[pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-300 bg-white px-5 py-4 text-left shadow-soft"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-lg font-extrabold text-leaf-950 sm:text-xl">
                        {result.prizeName}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        <span className="font-mono font-bold text-leaf-800">
                          {result.entryNumber}
                        </span>
                        {result.displayName ? (
                          <>
                            {" · "}
                            <span className="font-semibold">{result.displayName}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Trophy className="h-6 w-6 shrink-0 text-gold-500" aria-hidden="true" />
                  </li>
                ))}
              </ul>
              {phase === "revealing" && visibleResults.length < state.results.length ? (
                <p className="mt-4 text-sm text-slate-500">Revealing {visibleResults.length} of {state.results.length}…</p>
              ) : null}
            </div>
          )}
        </div>

        {state.status !== "COMPLETED" ? (
          <div className="border-t border-slate-200 bg-white px-5 py-6 text-center sm:px-10">
            <p className="font-display text-xl font-extrabold text-leaf-950">{copy.title}</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">{copy.body}</p>
            {state.status === "LOCKED" ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold text-leaf-800">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Pool fingerprint {shortHash(state.poolHash)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* integrity */}
      {state.status === "COMPLETED" && state.integrity ? (
        <div className="mt-6 rounded-3xl border border-leaf-200 bg-leaf-50/60 p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-leaf-950">
            <ShieldCheck className="h-5 w-5 text-leaf-600" aria-hidden="true" />
            How this result was produced
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Winners were chosen on the server with a cryptographically secure random generator. The
            fingerprints below let anybody reproduce the exact selection.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Participant list hash", value: state.integrity.poolHash },
              { label: "Selection commitment", value: state.integrity.commitHash },
              { label: "Random seed (revealed after)", value: state.integrity.entropy },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white p-4">
                <dt className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
                  <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </dt>
                <dd className="mt-1.5 break-all font-mono text-xs text-slate-700">
                  {shortHash(item.value, 24)}
                </dd>
                {item.value ? (
                  <div className="mt-2">
                    <CopyButton value={item.value} label="Copy hash" />
                  </div>
                ) : null}
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            The seed is published only once the draw is complete — so the commitment could not have
            been chosen after seeing the outcome.
          </p>
        </div>
      ) : null}

      {/* footer / actions */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {error ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700" role="status">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            {error}
          </p>
        ) : lastUpdated ? (
          <p className="text-xs text-slate-400">Updated {lastUpdated}</p>
        ) : null}

        {mode === "page" ? (
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <ButtonLink href="/draw/display" variant="outline">
              <MonitorUp className="h-4 w-4" aria-hidden="true" />
              Open projector view
            </ButtonLink>
            <ButtonLink href="/rules" variant="ghost">
              How the draw works
            </ButtonLink>
          </div>
        ) : (
          <ButtonLink href="/draw" variant="outline" size="sm">
            Back to the normal view
          </ButtonLink>
        )}
      </div>

      {mode === "display" ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          Projector view · press F11 for full screen ·{" "}
          <Link href="/draw" className="underline underline-offset-2">
            return to the site
          </Link>
        </p>
      ) : null}
    </div>
  );
}
