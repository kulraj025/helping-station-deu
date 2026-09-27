"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, Chrome, KeyRound, Leaf, Lock, LogIn, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

type Mode = "student" | "organiser";

export interface LoginFormProps {
  callbackUrl?: string;
  reason?: string;
  /**
   * Whether the Google provider is configured on the server. Passed in by the
   * login page rather than read from `process.env` here: this file is a client
   * component, and non-`NEXT_PUBLIC_` variables are stripped from the browser
   * bundle, which would drop the button on hydration.
   */
  googleEnabled?: boolean;
  /** Whether the KakaoTalk provider is configured on the server. */
  kakaoEnabled?: boolean;
  /** Error code handed over from the `?error=` query string. */
  initialError?: string;
}

const messages: Record<string, string> = {
  CredentialsSignin: "That e-mail address, password or claim code did not match our records.",
  AccessDenied: "You do not have permission to open that page.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  OAuthEmailMissing:
    "That account did not share an e-mail address. Grant e-mail access and try again.",
  OAuthDomainNotAllowed: "Only @deu.ac.kr accounts can sign in here.",
};

export function LoginForm({
  callbackUrl = "/account",
  reason,
  googleEnabled = false,
  kakaoEnabled = false,
  initialError,
}: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("student");
  const [useClaimCode, setUseClaimCode] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? (messages[initialError] ?? null) : null,
  );
  const [pending, startTransition] = useTransition();

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
        setError(messages[result.error] ?? "Sign-in failed. Please try again.");
        return;
      }
      router.replace(mode === "organiser" && callbackUrl === "/account" ? "/admin" : callbackUrl);
      router.refresh();
    });
  }

  function handleOAuthSignIn(provider: "google" | "kakao") {
    setError(null);
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

        {/* OAuth buttons. Shown on the Student tab only — organisers always
            sign in with e-mail and password. */}
        {mode === "student" && (googleEnabled || kakaoEnabled) ? (
          <div className="mt-6 space-y-2.5">
            {googleEnabled ? (
              <button
                type="button"
                onClick={() => handleOAuthSignIn("google")}
                disabled={pending}
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-leaf-300 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Chrome className="h-4 w-4" aria-hidden="true" />
                <span>Continue with Google</span>
              </button>
            ) : null}

            {kakaoEnabled ? (
              <button
                type="button"
                onClick={() => handleOAuthSignIn("kakao")}
                disabled={pending}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#FEE500] px-4 py-2.5 text-sm font-bold text-[#191600] transition hover:bg-[#f5d900] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#191600] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                <span>Continue with KakaoTalk</span>
              </button>
            ) : null}

            <p className="flex items-center gap-3 pt-1 text-xs font-semibold text-slate-400">
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              or use your university account
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </p>
            <p className="text-center text-xs text-slate-500">
              Google and KakaoTalk sign-in is limited to{" "}
              <span className="font-semibold text-slate-600">@deu.ac.kr</span> addresses.
            </p>
          </div>
        ) : null}

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

        {/* mode tabs */}
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          {mode === "student" ? (
            <>
              <Field
                label="University e-mail"
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
                  <Input
                    id="password"
                    name="password"
                    type="password"
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
                <Input
                  id="password"
                  name="password"
                  type="password"
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
