"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { setEventStatusAction } from "@/server/actions/admin-events";
import { EventStatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FLOW = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
] as const;

const HINTS: Record<string, string> = {
  DRAFT: "Nobody can see this event. Safe place to work on the details.",
  PUBLISHED: "The event page and registration form are public.",
  REGISTRATION_CLOSED: "No new registrations. You can now confirm attendance.",
  IN_PROGRESS: "The event is running. Registration stays closed.",
  COMPLETED: "The event is over. Winners and prizes remain visible.",
  ARCHIVED: "Hidden from the default event list. Nothing is deleted.",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf-700 px-5 text-sm font-bold text-white transition hover:bg-leaf-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Saving…" : "Change status"}
    </button>
  );
}

/**
 * Lifecycle control.
 *
 * Deliberately a select + explicit button rather than a set of buttons: the
 * organiser has to look at where the event is going, and pressing "publish" by
 * accident is a real risk.
 */
export function StatusChanger({
  eventId,
  currentStatus,
  statuses,
  drawStatus,
}: {
  eventId: string;
  currentStatus: string;
  statuses: readonly string[];
  drawStatus: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [next, setNext] = useState(currentStatus);
  const changed = next !== currentStatus;

  // A completed draw constrains the destination statuses.
  const blocked = drawStatus === "COMPLETED" ? ["DRAFT", "PUBLISHED", "REGISTRATION_CLOSED", "IN_PROGRESS"] : [];
  const options = statuses.filter((status) => !blocked.includes(status));
  const isForward = FLOW.indexOf(next as (typeof FLOW)[number]) > FLOW.indexOf(currentStatus as (typeof FLOW)[number]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-display text-base font-extrabold text-leaf-950">Lifecycle</h2>
        <p className="mt-1 text-sm text-slate-600">Where this event is in its life.</p>
      </header>

      <div className="p-5">
        <div className="flex items-center gap-2">
          <EventStatusBadge status={currentStatus} />
          {changed ? (
            <>
              <span className="text-slate-400" aria-hidden="true">
                →
              </span>
              <EventStatusBadge status={next} />
            </>
          ) : null}
        </div>

        <form ref={formRef} action={setEventStatusAction} className="mt-4 space-y-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="status" value={next} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              New status
            </span>
            <Select value={next} onChange={(event) => setNext(event.target.value)}>
              {options.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </label>

          <p
            className={cn(
              "rounded-xl p-3 text-xs leading-relaxed",
              changed && isForward && next === "PUBLISHED"
                ? "bg-amber-50 text-amber-900"
                : "bg-slate-50 text-slate-600",
            )}
          >
            {HINTS[next] ?? ""}
            {changed && next === "PUBLISHED" ? (
              <strong className="mt-1 block font-extrabold">
                Check the deadline first — it must still be in the future.
              </strong>
            ) : null}
          </p>

          {drawStatus === "COMPLETED" ? (
            <p className="rounded-xl bg-leaf-50 p-3 text-xs font-semibold text-leaf-800">
              The draw is complete, so the event can only be COMPLETED or ARCHIVED.
            </p>
          ) : null}

          <SubmitButton disabled={!changed} />
        </form>
      </div>
    </section>
  );
}
