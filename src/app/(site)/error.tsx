"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ServerCrash, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Public error boundary.
 *
 * The error message from the server is not shown to visitors: it can contain
 * query fragments or internal wording. It is logged to the console, where the
 * operator can see it, and the visitor gets a plain apology and a way out.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error on a public page:", error);
  }, [error]);

  return (
    <section className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700">
        <TriangleAlert className="h-8 w-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 font-display text-2xl font-extrabold text-leaf-950 sm:text-3xl">
        Something went wrong on our side
      </h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-700">
        This is our fault, not yours. Nothing you entered has been lost, and your registration is
        unaffected if you had already completed one.
      </p>

      {error.digest ? (
        <p className="mt-4 rounded-full bg-slate-100 px-4 py-1.5 font-mono text-xs text-slate-600">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          <ServerCrash className="h-4 w-4" aria-hidden="true" />
          Go to the home page
        </ButtonLink>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Still stuck?{" "}
        <Link href="/rules" className="font-semibold text-leaf-700 underline underline-offset-2">
          Read the rules
        </Link>{" "}
        or contact the organiser directly.
      </p>
    </section>
  );
}
