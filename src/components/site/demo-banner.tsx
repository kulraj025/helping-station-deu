import { FlaskConical } from "lucide-react";

/**
 * Demo mode banner.
 *
 * Shown on every page (except the projector display) while `DEMO_MODE=true` so
 * nobody can mistake fictional participants for real students.
 */
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-300">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        Demo mode
      </span>
    );
  }

  return (
    <div
      role="status"
      className="no-print border-b border-amber-300 bg-amber-100 text-amber-900"
    >
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-xs font-semibold sm:text-sm">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-extrabold">Demo mode is on.</strong> All participants, entry
          numbers and winners on this site are fictional test data and never mix with real event
          data.
        </span>
      </div>
    </div>
  );
}
