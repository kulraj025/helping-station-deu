"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Ticket,
  Printer,
} from "lucide-react";
import { registerAction } from "@/server/actions/register";
import { initialRegisterState, type RegisterState } from "@/lib/action-state";
import { DEPARTMENTS, VOLUNTEER_ROLES } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Field, FormAlert, FormRow, Input, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { formatEventDate, formatTimeRange } from "@/lib/format";

export interface RegisterEventInfo {
  id: string;
  name: string;
  slug: string;
  startAt: string;
  endAt: string;
  locationName: string;
  registrationDeadline: string;
  requireEmergencyContact: boolean;
  settings: {
    complianceNote: string | null;
    prizeClaimNote: string | null;
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Spinner label="Submitting…" /> : (
        <>
          <Ticket className="h-4 w-4" aria-hidden="true" />
          Complete registration
        </>
      )}
    </Button>
  );
}

/** Shown after a successful registration. */
function SuccessPanel({ state }: { state: RegisterState }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      role="status"
      className="overflow-hidden rounded-3xl border-2 border-leaf-300 bg-white shadow-lift"
    >
      <div className="bg-leaf-700 px-6 py-6 text-center text-white sm:px-8">
        <CheckCircle2 className="mx-auto h-11 w-11" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-extrabold">You are registered!</h2>
        <p className="mt-1 text-sm text-leaf-50">
          {state.eventName} · Your entry number is
        </p>
        <p className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          {state.entryNumber}
        </p>
      </div>

      <div className="space-y-5 p-6 sm:p-8">
        {state.message ? (
          <FormAlert tone="warning" title="Demo mode">
            {state.message}
          </FormAlert>
        ) : null}

        {state.claimCode ? (
          <div className="rounded-2xl border-2 border-dashed border-gold-300 bg-amber-50 p-5">
            <h3 className="flex items-center gap-2 font-bold text-amber-900">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Your one-time sign-in code
            </h3>
            <p className="mt-1.5 text-sm text-amber-800">
              Write this down now — it is shown only once. Use it with your e-mail address to sign
              in and see your participation status and any prizes.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code className="rounded-xl bg-white px-4 py-2.5 font-mono text-2xl font-bold tracking-[0.3em] text-leaf-900 ring-1 ring-amber-300">
                {state.claimCode}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(state.claimCode ?? "");
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2500);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
          </div>
        ) : (
          <FormAlert tone="info" title="Already have a password?">
            You registered before, so use the password you set. If you never set one, sign in with
            the claim code from your first registration.
          </FormAlert>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink
            href={`/success?entry=${encodeURIComponent(state.entryNumber ?? "")}`}
            variant="secondary"
            size="md"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Printable participation card
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" size="md">
            Sign in to my account
          </ButtonLink>
        </div>

        <p className="text-sm text-slate-500">
          Your name, e-mail, phone number and student ID are never shown on public pages. Only your
          entry number — and, if you opted in, a masked name — can appear.
        </p>
      </div>
    </div>
  );
}

export function RegistrationForm({ event }: { event: RegisterEventInfo }) {
  const [state, formAction] = useActionState<RegisterState, FormData>(
    registerAction,
    initialRegisterState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [renderedAt, setRenderedAt] = useState<number>(0);

  // Timestamp the moment the form became usable — a submission faster than
  // 1.2s is treated as automated.
  useEffect(() => {
    setRenderedAt(Date.now());
  }, []);

  // Clear the focus ring noise on success.
  useEffect(() => {
    if (state.status === "success") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.status]);

  // Focus the first field that the server rejected. `fieldErrors` is a fresh
  // object on every render, so it is memoised to keep this from re-running the
  // focus effect on every keystroke.
  const errors = useMemo(() => state.fieldErrors ?? {}, [state.fieldErrors]);
  const firstError = useMemo(() => Object.keys(errors)[0], [errors]);

  if (state.status === "success") {
    return <SuccessPanel state={state} />;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-8"
      noValidate
      aria-describedby={state.status === "error" ? "form-error-summary" : undefined}
    >
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="renderedAt" value={renderedAt} />

      {/* Honeypot: hidden from humans, irresistible to naive bots. */}
      <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && state.message ? (
        <div id="form-error-summary">
          <FormAlert tone="error" title="We could not complete your registration">
            {state.message}
          </FormAlert>
        </div>
      ) : null}

      {/* ---------------- who you are ---------------- */}
      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-extrabold text-leaf-950">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
              1
            </span>
            About you
          </span>
        </legend>

        <FormRow>
          <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.[0]}>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              defaultValue={state.values?.fullName}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              required
            />
          </Field>

          <Field
            label="University e-mail"
            htmlFor="email"
            required
            error={errors.email?.[0]}
            hint="Use your university address so we can verify you are a student."
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state.values?.email}
              aria-invalid={Boolean(errors.email)}
              required
            />
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Student ID" htmlFor="studentId" required error={errors.studentId?.[0]}>
            <Input
              id="studentId"
              name="studentId"
              defaultValue={state.values?.studentId}
              placeholder="20240001"
              autoComplete="off"
              aria-invalid={Boolean(errors.studentId)}
              required
            />
          </Field>

          <Field label="Department" htmlFor="department" required error={errors.department?.[0]}>
            <Select
              id="department"
              name="department"
              defaultValue={state.values?.department ?? ""}
              aria-invalid={Boolean(errors.department)}
              required
            >
              <option value="">Select your department…</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>
          </Field>
        </FormRow>

        <Field
          label="Phone number"
          htmlFor="phone"
          required
          error={errors.phone?.[0]}
          hint="Used for on-the-day safety only. Never published."
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={state.values?.phone}
            placeholder="010-0000-0000"
            aria-invalid={Boolean(errors.phone)}
            required
          />
        </Field>
      </fieldset>

      {/* ---------------- participation ---------------- */}
      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-extrabold text-leaf-950">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
              2
            </span>
            How you want to help
          </span>
        </legend>

        <Field
          label="Preferred volunteer role"
          htmlFor="volunteerRole"
          optional
          error={errors.volunteerRole?.[0]}
          hint="We will do our best to place you in this team."
        >
          <Select id="volunteerRole" name="volunteerRole" defaultValue={state.values?.volunteerRole ?? ""}>
            <option value="">No preference</option>
            {VOLUNTEER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </Field>

        <div className="rounded-2xl border border-slate-200 bg-canvas p-5">
          <p className="text-sm font-bold text-slate-800">
            Emergency contact{" "}
            {event.requireEmergencyContact ? (
              <span className="text-red-600">(required)</span>
            ) : (
              <span className="text-xs font-semibold text-slate-400">(optional)</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Only used if something happens during the event.
          </p>
          <FormRow className="mt-4">
            <Field label="Contact name" htmlFor="emergencyContactName" error={errors.emergencyContactName?.[0]}>
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={state.values?.emergencyContactName}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Contact phone"
              htmlFor="emergencyContactPhone"
              error={errors.emergencyContactPhone?.[0]}
            >
              <Input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                inputMode="tel"
                defaultValue={state.values?.emergencyContactPhone}
                autoComplete="off"
              />
            </Field>
          </FormRow>
        </div>
      </fieldset>

      {/* ---------------- consents ---------------- */}
      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-extrabold text-leaf-950">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-800">
              3
            </span>
            Consent
          </span>
          <span className="mt-1.5 block text-sm font-normal text-slate-500">
            Each item is separate on purpose — nothing is bundled together.
          </span>
        </legend>

        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-leaf-300"
          htmlFor="agreeRules"
        >
          <Checkbox id="agreeRules" name="agreeRules" defaultChecked aria-invalid={Boolean(errors.agreeRules)} />
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">I have read and accept the participation rules.</span>{" "}
            <Link href="/rules" target="_blank" className="font-semibold text-leaf-700 underline underline-offset-2">
              Open the rules
            </Link>
            {errors.agreeRules?.[0] ? (
              <span role="alert" className="mt-1 block text-xs font-semibold text-red-600">
                {errors.agreeRules[0]}
              </span>
            ) : null}
          </span>
        </label>

        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-leaf-300"
          htmlFor="dataConsent"
        >
          <Checkbox id="dataConsent" name="dataConsent" defaultChecked aria-invalid={Boolean(errors.dataConsent)} />
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">I consent to my details being processed for this event.</span>{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-leaf-700 underline underline-offset-2">
              Read the privacy policy
            </Link>
            {errors.dataConsent?.[0] ? (
              <span role="alert" className="mt-1 block text-xs font-semibold text-red-600">
                {errors.dataConsent[0]}
              </span>
            ) : null}
          </span>
        </label>

        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-leaf-200 bg-leaf-50/60 p-4 transition hover:border-leaf-400"
          htmlFor="drawConsent"
        >
          <Checkbox
            id="drawConsent"
            name="drawConsent"
            defaultChecked
            className="border-leaf-400"
            aria-invalid={Boolean(errors.drawConsent)}
          />
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              I consent to being entered into the lucky draw.
            </span>{" "}
            Required to win. You get exactly one entry, only if the organiser confirms you took
            part, and only if you are not already a winner of this event.
            {errors.drawConsent?.[0] ? (
              <span role="alert" className="mt-1 block text-xs font-semibold text-red-600">
                {errors.drawConsent[0]}
              </span>
            ) : null}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-azure-300"
            htmlFor="publicDisplayConsent"
          >
            <Checkbox id="publicDisplayConsent" name="publicDisplayConsent" />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Show a masked name on the winners page</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Optional. For example “M**i P***”.
              </span>
            </span>
          </label>

          <label
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-azure-300"
            htmlFor="contactConsent"
          >
            <Checkbox id="contactConsent" name="contactConsent" />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Contact me about collecting a prize</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Optional. Without this we cannot tell you that you won.
              </span>
            </span>
          </label>
        </div>

        {state.showCaptcha ? (
          <FormAlert tone="warning" title="Extra check needed">
            Please submit the form again. If this keeps happening, contact the organiser directly.
          </FormAlert>
        ) : null}
      </fieldset>

      {/* ---------------- submit ---------------- */}
      <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Your details are stored securely and never published.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/rules"
            className="inline-flex h-11 items-center justify-center px-2 text-sm font-semibold text-slate-600 underline-offset-4 hover:underline"
          >
            Review the rules first
          </Link>
          <SubmitButton />
        </div>
      </div>

      {firstError ? (
        <p className="sr-only" role="status">
          The form has validation errors. The first one is on the field labelled as required.
        </p>
      ) : null}
    </form>
  );
}

/** Small summary card shown beside the form on desktop. */
export function EventSummaryCard({ event }: { event: RegisterEventInfo }) {
  return (
    <aside className="rounded-3xl border border-leaf-200 bg-white p-6 shadow-soft lg:sticky lg:top-24">
      <Badge tone="leaf" dot>
        Registration open
      </Badge>
      <h2 className="mt-4 font-display text-xl font-extrabold text-leaf-950">{event.name}</h2>
      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Date</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">{formatEventDate(event.startAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Time</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">
            {formatTimeRange(event.startAt, event.endAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Where</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">{event.locationName}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Closes</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">
            {formatEventDate(event.registrationDeadline)}
          </dd>
        </div>
      </dl>

      <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-xs text-slate-600">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
          One entry per student, per event. Duplicate registrations are blocked automatically.
        </p>
        {event.settings.prizeClaimNote ? (
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />
            {event.settings.prizeClaimNote}
          </p>
        ) : null}
        {event.settings.complianceNote ? (
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {event.settings.complianceNote}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
