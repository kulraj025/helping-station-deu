import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { adminSetupAvailable } from "@/server/actions/setup-actions";
import { SetupExplainer, SetupForm } from "@/components/auth/setup-form";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Set up the organiser account",
  description: "Create the first organiser account for this deployment.",
  // Never indexed: the page is a one-shot bootstrap door, and there is no
  // reason for it to appear in a search result.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await getCurrentUser();
  // Someone already signed in has no business here.
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/account");

  const available = await adminSetupAvailable();

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
      <div className="container-page relative flex flex-col items-center">
        <Reveal from="up" className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lift sm:p-8">
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-leaf-700 text-white">
                <Leaf className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="mt-4 font-display text-2xl font-extrabold text-leaf-950">
                Set up your site
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Create the organiser account that will manage events, participants and the draw.
              </p>
            </div>

            {available ? (
              <>
                <div className="mt-6">
                  <SetupForm />
                </div>
                <div className="mt-6">
                  <SetupExplainer />
                </div>
              </>
            ) : (
              <div className="mt-6">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-extrabold">Setup is not available.</p>
                    <p className="mt-1.5">
                      This is expected once an organiser account exists, and also when{" "}
                      <code className="font-mono text-xs">ADMIN_SETUP_TOKEN</code> is not set in the
                      environment.
                    </p>
                    <p className="mt-2">
                      To bootstrap a fresh site, set that variable to any long random string,
                      deploy, and open this page once. Passwords need at least{" "}
                      {PASSWORD_MIN_LENGTH} characters.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-slate-500">
            Already set up?{" "}
            <Link
              href="/login"
              className="font-semibold text-leaf-700 underline underline-offset-2"
            >
              Sign in
            </Link>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <ButtonLink href="/" variant="ghost" size="sm">
              Back to the site
            </ButtonLink>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
