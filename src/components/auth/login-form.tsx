"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, KeyRound, Leaf, Lock, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { GoogleSignInButton, SignInDivider } from "@/components/ui/google-button";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

type Mode = "student" | "organiser";

export interface LoginFormProps {
  callbackUrl?: string;
  reason?: string;
  /** Whether the Google provider is configured on the server. Passed in by the
   *  login page rather than read from `process.env` here: this file is a client
   *  component, and non-`NEXT_PUBLIC_` variables are stripped from the browser
   *  bundle, which would drop the button on hydration. */
  googleEnabled?: boolean;
  /** Email domain Google sign-in is restricted to, or "" when anyone may sign in. */
  allowedDomain?: string;
  /** Error code handed over from the `?error=` query string. */
  initialError?: string;
  /**
   * Which tab to open on.
   *
   * The student tab is the common case, but it must not be the *only*
   * default. Signing in with an organiser e-mail on the student tab submits to
   * the student provider, which rejects the account because its role is ADMIN,
   * and every rejection comes back as the same `CredentialsSignin`. A correct
   * organiser login then looks exactly like a wrong password. Letting the
   * server pick the tab keeps the `/admin` bounce path usable.
   */
  mode?: Mode;
}

const messages: Record<string, string> = {
  AccessDenied: "You do not have permission to open that page.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  OAuthEmailMissing:
    "That account did not share an e-mail address. Grant e-mail access and try again.",
  OAuthDomainNotAllowed: "That e-mail domain cannot sign in here.",
};

/**
 * Copy for a rejected set of credentials.
 *
 * Auth.js returns one opaque `CredentialsSignin` for an unknown e-mail, a
 * wrong password, an account of the other type and a tripped rate limit — that
 * collapse is deliberate and must not be undone, or the form becomes a probe
 * for which e-mail addresses exist. So this does not claim to know which check
 * failed; it names the likely cause and the way out, which is what was missing
 * when a valid organiser login reported "did not match our records".
 */
function rejectedMessage(mode: Mode): string {
  return mode === "organiser"
    ? "That organiser e-mail and password did not match. Check the address, or use the Student tab if you are signing in with your university e-mail. After several failed attempts this form pauses for a few minutes."
    : "That university e-mail and password did not match. Check the address, or use the Organiser tab if you are signing in as the event organiser. After several failed attempts this form pauses for a few minutes.";
}

/** The domain notice varies with configuration, so it is built per-render. */
function domainNotAllowedMessage(allowedDomain: string) {
  return allowedDomain
    ? `Only ${allowedDomain} accounts can sign in here.`
    : "That account cannot sign in here.";
}

export function LoginForm({
  callbackUrl = "/account",
  reason,
  googleEnabled = false,
  allowedDomain = "",
  initialError,
  mode: initialMode,
}: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode ?? "student");
  const [useClaimCode, setUseClaimCode] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError === "OAuthDomainNotAllowed"
      ? domainNotAllowedMessage(allowedDomain)
      : initialError
        ? (messages[initialError] ?? null)
        : null,
  );
  const [pending, startTransition] = useTransition();
  // Tracked apart from `pending`: that flag is also set while the e-mail form
  // is submitting, and a Google button that read "Opening Google…" at that
  // moment would be lying about what is happening.
  const [oauthPending, setOauthPending] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const claimCode = String(data.get("claimCode") ?? "").trim().toUpperCase();
    const provider = mode === "organiser" ? "admin" : "student";
    const payload =
      mode === "organiser"
        ? { email: identifier, password, website: String(data.get("website") ?? "") }
        : useClaimCode
          ? { identifier, claimCode }
          : { identifier, password };

    startTransition(async () => {
      const result = await signIn(provider, { ...payload, redirect: false });
      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? rejectedMessage(mode)
            : (messages[result.error] ?? "Sign-in failed. Please try again."),
        );
        return;
      }
      router.replace(mode === "organiser" && callbackUrl === "/account" ? "/admin" : callbackUrl);
      router.refresh();
    });
  }

  function handleOAuthSignIn(provider: "google") {
    setError(null);
    setOauthPending(true);
    startTransition(async () => {
      await signIn(provider, { callbackUrl: mode === "organiser" ? "/admin" : callbackUrl });
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lift sm:p-8">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-leaf-700 text-white">
            <Leaf className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-leaf-950">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Sign in to check your participation status and prizes.
          </p>
        </div>

        {/* Which kind of account you are decides everything below it — whether
            Google is offered at all, and where you land afterwards — so it is
            asked before either sign-in method, not wedged between them. */}
        <div
          className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1"
          role="tablist"
          aria-label="Sign-in type"
        >
          {(
            [
              { id: "student" as const, label: "Student", icon: UserRound },
              { id: "organiser" as const, label: "Organiser", icon: ShieldCheck },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition",
                  mode === tab.id
                    ? "bg-white text-leaf-800 shadow-soft"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {reason === "auth" ? (
          <div className="mt-6 rounded-full bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="alert">
            Please sign in to continue to that page.
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-full bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {/* Google sign-in. Student tab only — organisers always sign in with
            e-mail and password. Rendered only when the provider is configured.
            This is the shortest path in for a new visitor, so it gets the top
            position; the password form below is the fallback for people already
            registered that way. */}
        {mode === "student" && googleEnabled ? (
          <div className="mt-6 space-y-4">
            <GoogleSignInButton
              onClick={() => handleOAuthSignIn("google")}
              disabled={oauthPending}
            >
              {oauthPending ? "Opening Google…" : "Continue with Google"}
            </GoogleSignInButton>

            <SignInDivider>or use a password</SignInDivider>

            <p className="text-center text-xs text-slate-500">
              {allowedDomain ? (
                <>
                  Google sign-in is limited to{" "}
                  <span className="font-semibold text-slate-600">{allowedDomain}</span> addresses.
                </>
              ) : (
                <>Any Google account can sign in. You can add your department later.</>
              )}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          {mode === "student" ? (
            <>
              <Field
                label="E-mail"
                htmlFor="identifier"
                required
                hint="The address you used to register."
              >
                <Input
                  id="identifier"
                  name="identifier"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                />
              </Field>

              {useClaimCode ? (
                <Field
                  label="Claim code"
                  htmlFor="claimCode"
                  required
                  hint="The one-time code shown when you first registered."
                >
                  <Input
                    id="claimCode"
                    name="claimCode"
                    autoComplete="one-time-code"
                    className="font-mono tracking-[0.2em] uppercase"
                    placeholder="ABCD2345"
                    maxLength={16}
                    required
                  />
                </Field>
              ) : (
                <Field label="Password" htmlFor="password" required>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
              )}

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <Checkbox
                  type="checkbox"
                  checked={useClaimCode}
                  onChange={(event) => setUseClaimCode(event.target.checked)}
                />
                I am signing in with a claim code instead
              </label>
            </>
          ) : (
            <>
              <Field label="Organiser e-mail" htmlFor="identifier" required>
                <Input
                  id="identifier"
                  name="identifier"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Password" htmlFor="password" required>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              {/* Honeypot */}
              <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
            </>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Spinner label="Signing in…" /> : (
              <>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 space-y-2 rounded-2xl bg-canvas p-4 text-xs text-slate-600">
          <p className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-600" aria-hidden="true" />
            <span>
              <strong className="font-bold text-slate-800">Claim code?</strong> It is the one-time
              code shown on your registration confirmation. Using it once lets you set a password.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-600" aria-hidden="true" />
            <span>
              Lost your code? Ask the organiser to resend it. We never display or e-mail it a
              second time.
            </span>
          </p>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-slate-500">
        Trouble signing in?{" "}
        <a href="mailto:helpingstation@deu.ac.kr" className="font-semibold text-leaf-700 underline underline-offset-2">
          Contact the organiser
        </a>
      </p>

      {error ? (
        <p className="sr-only" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> Sign-in failed.
        </p>
      ) : null}
    </div>
  );
}
