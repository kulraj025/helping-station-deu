"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Organiser-area error boundary.
 *
 * Separate from the public one because the recovery advice differs: an
 * organiser mid-draw needs to know the state of the draw is untouched, not
 * just that a page failed to render.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in the organiser area:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-display text-lg font-extrabold text-red-900">
        This page could not be loaded
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-900/90">
        The organiser interface hit an unexpected error. Nothing was changed: no draw was started, no
        pool was locked and no record was written. Reload the page and try the step again.
      </p>

      {error.digest ? (
        <p className="mt-3 inline-block rounded-lg bg-red-100 px-3 py-1.5 font-mono text-xs text-red-900">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          Reload this page
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          Back to the dashboard
        </ButtonLink>
        <ButtonLink href="/admin/audit" variant="outline">
          Check the audit log
        </ButtonLink>
      </div>
    </div>
  );
}
