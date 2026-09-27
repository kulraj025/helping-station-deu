import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/auth/login-form";
import { Reveal } from "@/components/ui/reveal";
import { DemoCredentials } from "@/components/auth/demo-credentials";
import { env, isGoogleEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to check your participation status, eligibility and any prizes you have won.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(params.callbackUrl ? String(params.callbackUrl) : "/account");

  // Read the query here on the server. The form used to call
  // `useSearchParams()` itself, which pushed it behind a `<Suspense>` boundary
  // that React left parked in a hidden container: present in the DOM, invisible
  // on screen, and impossible to submit.
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  // NextAuth bounces failed OAuth attempts back here with `?error=<code>`.
  const oauthError = typeof params.error === "string" ? params.error : undefined;

  /**
   * Resolved here, on the server, and handed to the form as a plain boolean.
   * The form is a client component, so if it read `process.env.GOOGLE_CLIENT_ID`
   * itself the value would be `undefined` in the browser bundle: the button
   * would render during SSR and then vanish on hydration.
   */
  const googleEnabled = isGoogleEnabled();

  return (
    <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-leaf-200/50 blur-3xl"
        aria-hidden="true"
      />
      <div className="container-page relative flex flex-col items-center">
        <Reveal from="up" className="w-full">
          <LoginForm
            callbackUrl={callbackUrl}
            reason={reason}
            googleEnabled={googleEnabled}
            allowedDomain={env.googleAllowedDomain}
            initialError={oauthError}
          />
        </Reveal>
        {env.demoMode ? (
          <Reveal from="up" delay={120} className="mt-6 w-full">
            <DemoCredentials />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
