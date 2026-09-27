"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import {
  cancelRegistrationAction,
  setPasswordAction,
  signOutAction,
} from "@/server/actions/account-actions";
import { initialAccountState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/input";
import { PasswordFieldPair } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/feedback";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

function SubmitButton({ label, pendingLabel, variant = "primary" }: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : label}
    </Button>
  );
}

export function SetPasswordPanel() {
  const [state, formAction] = useActionState(setPasswordAction, initialAccountState);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-leaf-950">
        <KeyRound className="h-5 w-5 text-leaf-600" aria-hidden="true" />
        Set a password
      </h2>
      <p className="mt-1.5 text-sm text-slate-600">
        You signed in with a one-time claim code. Choose a password so you do not need the code
        again. At least {PASSWORD_MIN_LENGTH} characters — any characters you like.
      </p>

      {state.status === "success" ? (
        <FormAlert tone="success" className="mt-4" title="Password saved">
          {state.message}
        </FormAlert>
      ) : state.status === "error" ? (
        <FormAlert tone="error" className="mt-4">
          {state.message}
        </FormAlert>
      ) : null}

      <form action={formAction} className="mt-5">
        <PasswordFieldPair
          error={state.fieldErrors?.password?.[0]}
          confirmError={state.fieldErrors?.confirmPassword?.[0]}
        />
        <div className="mt-5">
          <SubmitButton label="Save password" pendingLabel="Saving…" />
        </div>
      </form>
    </section>
  );
}

export function CancelRegistrationButton({
  registrationId,
  entryNumber,
  onDone,
}: {
  registrationId: string;
  entryNumber: string;
  onDone?: (message: string) => void;
}) {
  const [state, formAction] = useActionState(cancelRegistrationAction, initialAccountState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toast = useToast();

  // Tell the page above us when the withdrawal lands, so the row can be removed
  // or a message shown without this component owning the layout.
  useEffect(() => {
    if (state.status === "success" && state.message) onDone?.(state.message);
  }, [state.status, state.message, onDone]);

  if (state.status === "success") {
    if (!onDone) {
      return <FormAlert tone="success">{state.message ?? "Registration cancelled."}</FormAlert>;
    }
    return null;
  }

  return (
    <>
      <form
        action={formAction}
        onSubmit={() => {
          dialogRef.current?.close();
        }}
      >
        <input type="hidden" name="registrationId" value={registrationId} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dialogRef.current?.showModal()}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Withdraw
        </Button>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby={`cancel-title-${registrationId}`}
        className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-0 shadow-glow backdrop:bg-slate-900/50"
      >
        <div className="p-6">
          <h2 id={`cancel-title-${registrationId}`} className="font-display text-xl font-extrabold text-leaf-950">
            Withdraw your registration?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            This releases your place ({entryNumber}) for somebody on the waiting list. You can
            register again later if places remain.
          </p>
          {state.status === "error" ? (
            <FormAlert tone="error" className="mt-4">
              {state.message}
            </FormAlert>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => dialogRef.current?.close()}
            >
              Keep my place
            </Button>
            <Button
              type="submit"
              formAction={formAction}
              variant="danger"
              onClick={() => {
                dialogRef.current?.close();
                toast.info("Cancelling your registration…");
              }}
            >
              Yes, withdraw
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => startTransition(() => void signOutAction())}
      disabled={pending}
    >
      {pending ? <Spinner label="Signing out…" /> : (
        <>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </>
      )}
    </Button>
  );
}

export function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-azure-200 bg-azure-50 p-4 text-sm text-azure-600">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Only you and the event organiser can see your registration details. Public pages show your
        entry number, and a masked name only if you opted in.
      </span>
    </p>
  );
}
