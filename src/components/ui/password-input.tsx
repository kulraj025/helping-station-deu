"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle.
 *
 * People mistype passwords constantly on a phone, and a field that only ever
 * renders dots gives them nothing to check against. The toggle is a real
 * `<button>` inside the field rather than a CSS hack, so it is keyboard
 * reachable and announced. It deliberately does not steal focus, and it
 * deliberately does not change the input type while it holds focus — flipping
 * `type` mid-typing would move the caret to the end on some mobile browsers.
 *
 * The extra right padding is applied here rather than by callers, so the icon
 * cannot overlap the text.
 */
export function PasswordInput({
  className,
  ...props
}: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        // The label is read on every page this appears on, so it describes the
        // action rather than the icon.
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 transition hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-leaf-600"
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Live feedback for the one rule we enforce: length.
 *
 * Shown as a checklist rather than a coloured bar because a bar has to guess
 * at "strong" and "weak", and a guess that turns red on somebody's perfectly
 * reasonable passphrase is just annoying. A checklist says exactly what is
 * still missing and nothing more, so it cannot be wrong.
 *
 * Announced politely: the list updates on every keystroke, and a live region
 * that fires on every keystroke would talk over the person typing.
 */
export function PasswordRuleList({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const longEnough = value.length >= PASSWORD_MIN_LENGTH;

  return (
    <ul
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs",
        className,
      )}
    >
      <li
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 font-medium transition-colors",
          longEnough ? "text-emerald-700" : "text-slate-500",
        )}
      >
        {longEnough ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <X className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        )}
        <span>
          At least {PASSWORD_MIN_LENGTH} characters
          <span className="sr-only">
            {longEnough ? " — requirement met" : " — still needed"}
          </span>
        </span>
      </li>
    </ul>
  );
}

/** Confirms the two fields agree, as soon as the second one has been typed in. */
export function PasswordMatchHint({
  password,
  confirm,
}: {
  password: string;
  confirm: string;
}) {
  if (confirm.length === 0) return null;
  const matches = password === confirm;

  return (
    <p
      aria-live="polite"
      className={cn(
        "mt-2 flex items-center gap-1.5 text-xs font-medium",
        matches ? "text-emerald-700" : "text-red-600",
      )}
    >
      {matches ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {matches ? "Passwords match" : "Passwords do not match yet"}
    </p>
  );
}

/** Convenience wrapper so callers do not have to hold the value in two places. */
export function PasswordFieldPair({
  passwordLabel = "New password",
  confirmLabel = "Confirm password",
  autoComplete = "new-password",
  error,
  confirmError,
}: {
  passwordLabel?: ReactNode;
  confirmLabel?: ReactNode;
  autoComplete?: string;
  error?: string | undefined;
  confirmError?: string | undefined;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="new-password"
          className="flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-800"
        >
          <span>
            {passwordLabel}
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
          </span>
        </label>
        <PasswordInput
          id="new-password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <PasswordRuleList value={password} />
        {error ? (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirm-password"
          className="flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-800"
        >
          <span>
            {confirmLabel}
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
          </span>
        </label>
        <PasswordInput
          id="confirm-password"
          name="confirmPassword"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete={autoComplete}
          required
        />
        <PasswordMatchHint password={password} confirm={confirm} />
        {confirmError ? (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">
            {confirmError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
