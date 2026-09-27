import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Shown instead of a section the organiser has switched off.
 *
 * The copy has to work without naming the reason: the organiser may have closed
 * a section for any number of reasons, and "this is closed" is true in all of
 * them. The optional note is the one place a specific reason can appear, because
 * it is something the organiser typed on purpose.
 */
export function SectionClosed({
  sectionLabel,
  note,
  homeHref = "/",
}: {
  sectionLabel: string;
  note?: string;
  homeHref?: string;
}) {
  return (
    <section className="container-page flex flex-1 flex-col items-center justify-center py-16 sm:py-24">
      <div className="w-full max-w-lg text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-600">
          <Lock className="h-7 w-7" aria-hidden="true" />
        </span>

        <h1 className="mt-6 font-display text-2xl font-extrabold text-leaf-950 sm:text-3xl">
          {sectionLabel} is closed
        </h1>

        <p className="mt-3 text-base leading-relaxed text-slate-600">
          The organiser has closed this part of the site for now.
          {note ? <span className="mt-2 block font-semibold text-leaf-800">{note}</span> : null}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href={homeHref} size="lg" className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the home page
          </ButtonLink>
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Questions?{" "}
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
