"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircle, KeyRound, Leaf, Lock, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

type Mode = "student" | "organiser";

export interface LoginFormProps {
  /**
   * Where to send the user once they are signed in, and why they were sent here.
   *
   * Passed in from the server page rather than read with `useSearchParams()`:
   * that hook forces the form behind a `<Suspense>` boundary, and the boundary
   * then arrives as a hidden deferred container that React never reveals — the
   * form renders in the DOM but is invisible and unreachable. The server
   * already awaits `searchParams`, so there is nothing to gain from the hook.
   */
  callbackUrl?: string;
  reason?: string;
}

const messages: Record<string, string> = {
  CredentialsSignin: "That e-mail address, password or claim code did not match our records.",
  AccessDenied: "You do not have permission to open that page.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
};

export function LoginForm({ callbackUrl = "/account", reason }: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("student");
  const [useClaimCode, setUseClaimCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      // The session cookie is set; refresh so server components see it.
      router.replace(mode === "organiser" && callbackUrl === "/account" ? "/admin" : callbackUrl);
      router.refresh();
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

        {reason === "auth" ? (
          <FormAlert tone="info" className="mt-6" title="Sign in required">
            Please sign in to continue to that page.
          </FormAlert>
        ) : null}
        {error ? (
          <FormAlert tone="error" className="mt-6" title="Could not sign you in">
            {error}
          </FormAlert>
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
