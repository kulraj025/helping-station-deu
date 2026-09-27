"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Home, LifeBuoy, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Public error boundary.
 *
 * This must stay in place. It is the difference between a visitor seeing a calm
 * message with a way out, and seeing a stack trace or a blank white page — so it
 * is never removed, only made calmer.
 *
 * The tone is deliberate. The earlier copy led with "Something went wrong on our
 * side", which reads as *the whole site is broken* when in practice a single
 * route failed to render. The visitor's own situation is almost always fine, so
 * the page leads with that, keeps the technical detail small, and gives one
 * clear next action instead of a row of equally weighted buttons.
 *
 * The server's error message is never shown: it can contain query fragments and
 * internal wording. It goes to the console instead, where the operator can see
 * it, and the visitor gets the `digest` as a short reference instead.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("Unhandled error on a public page:", error);
  }, [error]);

  async function copyReference() {
    if (!error.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied. The reference is still on screen and
      // selectable, so failing to copy is not worth an error of its own.
    }
  }

  return (
    <section className="container-page flex flex-1 flex-col items-center justify-center py-16 sm:py-24">
      <div className="w-full max-w-lg text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-leaf-100 text-leaf-700">
          <LifeBuoy className="h-7 w-7" aria-hidden="true" />
        </span>

        <h1 className="mt-6 font-display text-2xl font-extrabold text-leaf-950 sm:text-3xl">
          This page didn&apos;t load
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Something on our side went wrong while drawing this page. Anything you already did is
          safe — a registration you completed is still registered.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" size="lg" onClick={reset} className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try loading it again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg" className="w-full sm:w-auto">
            <Home className="h-4 w-4" aria-hidden="true" />
            Go to the home page
          </ButtonLink>
        </div>

        {error.digest ? (
          <div className="mt-10 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              If you need to report this
            </p>
            <button
              type="button"
              onClick={copyReference}
              className="mx-auto mt-2 flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 font-mono text-xs text-slate-700 transition hover:bg-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600"
              aria-label={
                copied ? "Reference copied" : "Copy the error reference to your clipboard"
              }
            >
              {error.digest}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
            <p aria-live="polite" className="mt-2 text-xs text-slate-500">
              {copied ? "Copied — include this if you contact the organiser." : null}
            </p>
          </div>
        ) : null}

        <p className="mt-8 text-sm text-slate-500">
          Need a hand?{" "}
          <Link
            href="/rules"
            className="font-semibold text-leaf-700 underline underline-offset-2 hover:text-leaf-800"
          >
            Read the rules
          </Link>{" "}
          or contact the organiser directly.
        </p>
      </div>
    </section>
  );
}
