"use client";

import { useActionState } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { createFirstAdminAction } from "@/server/actions/setup-actions";
import { initialAccountState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/input";
import { PasswordFieldPair } from "@/components/ui/password-input";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/feedback";

/**
 * First-run organiser signup.
 *
 * Reached at `/setup` only when the deployment has an `ADMIN_SETUP_TOKEN` and
 * no admin yet — see `adminSetupAvailable`. The form asks for the token as an
 * ordinary field rather than hiding it, because the person using this is
 * setting up their own site and has the token in front of them.
 */
export function SetupForm() {
  const [state, formAction] = useActionState(createFirstAdminAction, initialAccountState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      <Field
        label="Your name"
        htmlFor="name"
        required
        error={state.fieldErrors?.name?.[0]}
      >
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
        />
      </Field>

      <Field
        label="Organiser e-mail"
        htmlFor="email"
        required
        hint="This is what you will sign in with."
        error={state.fieldErrors?.email?.[0]}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
        />
      </Field>

      <PasswordFieldPair
        passwordLabel="Password"
        confirmLabel="Confirm password"
        error={state.fieldErrors?.password?.[0]}
        confirmError={state.fieldErrors?.confirmPassword?.[0]}
      />

      <Field
        label="Setup token"
        htmlFor="setupToken"
        required
        hint="The ADMIN_SETUP_TOKEN value from your environment. Delete the variable once this account exists."
        error={state.fieldErrors?.setupToken?.[0]}
      >
        <Input
          id="setupToken"
          name="setupToken"
          type="password"
          autoComplete="off"
          className="font-mono"
          required
        />
      </Field>

      <SetupSubmit />
    </form>
  );
}

/**
 * Split out so `useFormStatus` reads the pending state of the form it is
 * inside. Calling that hook in the same component as the `<form>` would report
 * the status of the *parent* form, which is never pending.
 */
function SetupSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <Spinner label="Creating your account…" />
      ) : (
        <>
          <UserRound className="h-4 w-4" aria-hidden="true" />
          Create my organiser account
        </>
      )}
    </Button>
  );
}

/** Explains what `/setup` is for, and why it disappears. */
export function SetupExplainer() {
  return (
    <div className="space-y-3 rounded-2xl bg-canvas p-5 text-sm text-slate-600">
      <p className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
        <span>
          This page creates the <strong className="font-bold text-slate-800">first</strong>{" "}
          organiser account. Once one exists this page stops working, so there is no way to add
          organisers through it later.
        </span>
      </p>
      <p className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
        <span>
          Afterwards, remove <code className="font-mono text-xs">ADMIN_SETUP_TOKEN</code> from your
          environment and deploy again.
        </span>
      </p>
    </div>
  );
}
