"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Lock, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormAlert, FormRow, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { EVENT_STATUSES } from "@/lib/constants";
import {
  createEventAction,
  updateEventAction,
} from "@/server/actions/admin-events";
import { initialAdminState, type AdminActionState } from "@/lib/action-state";

export interface EventFormValues {
  id?: string;
  name: string;
  tagline: string;
  description: string;
  locationName: string;
  locationAddress: string;
  /** `datetime-local` strings, already in the user's local time. */
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  capacity: string;
  organizerName: string;
  organizerDepartment: string;
  organizerContact: string;
  status: string;
  isDemo: boolean;
  settings: {
    requireParticipationForEligibility: boolean;
    allowMultipleWinsPerParticipant: boolean;
    winnerDisplayMode: "MASKED" | "NONE";
    publicWinnersVisible: boolean;
    publicDrawScreenVisible: boolean;
    showParticipantCount: boolean;
    claimWindowDays: string;
    requireDrawConsent: boolean;
    requireEmergencyContact: boolean;
    prizeClaimNote: string;
    winnerContactMethod: string;
    complianceNote: string;
  };
}

/** Date → `datetime-local` value in the browser's timezone. */
export function toLocalInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft — hidden from the public",
  PUBLISHED: "Published — registration open",
  REGISTRATION_CLOSED: "Registration closed",
  IN_PROGRESS: "In progress — event is running",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

/**
 * Create / edit form.
 *
 * One component for both jobs: the fields are identical, and keeping them in
 * sync is what stops an organiser creating an event they cannot then edit.
 */
export function EventForm({
  values,
  mode,
  lockedFields = [],
  error,
}: {
  values: EventFormValues;
  mode: "create" | "edit";
  /** Field groups frozen by a locked draw pool, with the reason to show. */
  lockedFields?: Array<"deadline" | "drawRules" | "prizes">;
  error?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    mode === "create" ? createEventAction : updateEventAction,
    initialAdminState,
  );

  const [name, setName] = useState(values.name);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Jump to the new event once it exists, so the organiser lands on the
  // settings screen rather than back on a list that no longer matches.
  useEffect(() => {
    if (state.status === "success" && state.createdId) {
      router.push(`/admin/events/${state.createdId}?created=1`);
    }
  }, [state.status, state.createdId, router]);

  const errors = state.fieldErrors ?? {};
  const deadlineLocked = lockedFields.includes("deadline");
  const drawRulesLocked = lockedFields.includes("drawRules");

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && values.id ? <input type="hidden" name="eventId" value={values.id} /> : null}

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {state.status === "error" && state.message ? (
        <FormAlert tone="error" title="Could not save">
          {state.message}
        </FormAlert>
      ) : null}
      {state.status === "success" && state.message ? (
        <FormAlert tone="success" title="Saved">
          {state.message}
        </FormAlert>
      ) : null}

      {deadlineLocked ? (
        <FormAlert tone="warning" title="Part of this event is now frozen">
          The draw pool has been locked, so the registration deadline and the draw rules cannot be
          changed — the frozen participant list depends on them. Everything else is still editable.
        </FormAlert>
      ) : null}

      {/* ---------------- identity ---------------- */}
      <section className="space-y-5">
        <Field
          label="Event name"
          htmlFor={`${uid}-name`}
          required
          error={errors.name?.[0]}
          hint="Shown on every public page and on the poster."
        >
          <Input
            id={`${uid}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={3}
            maxLength={120}
            placeholder="Helping Station DEU — Spring Edition"
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field
          label="Tagline"
          htmlFor={`${uid}-tagline`}
          optional
            error={errors.tagline?.[0]}
          hint="One line under the title. Optional."
        >
          <Input
            id={`${uid}-tagline`}
            name="tagline"
            defaultValue={values.tagline}
            maxLength={160}
            placeholder="A day of volunteering, food and prizes"
          />
        </Field>

        <Field
          label="Description"
          htmlFor={`${uid}-description`}
          required
          error={errors.description?.[0]}
          hint="What happens, who it is for, and what to bring. At least 20 characters."
        >
          <Textarea
            id={`${uid}-description`}
            name="description"
            defaultValue={values.description}
            required
            rows={7}
            maxLength={4000}
            aria-invalid={Boolean(errors.description)}
          />
        </Field>
      </section>

      {/* ---------------- when & where ---------------- */}
      <section className="space-y-5 border-t border-slate-100 pt-6">
        <h3 className="font-display text-base font-extrabold text-leaf-950">When and where</h3>

        <FormRow>
          <Field
            label="Starts"
            htmlFor={`${uid}-startAt`}
            required
            error={errors.startAt?.[0]}
          >
            <Input
              id={`${uid}-startAt`}
              type="datetime-local"
              name="startAt"
              defaultValue={values.startAt}
              required
              aria-invalid={Boolean(errors.startAt)}
            />
          </Field>
          <Field label="Ends" htmlFor={`${uid}-endAt`} required error={errors.endAt?.[0]}>
            <Input
              id={`${uid}-endAt`}
              type="datetime-local"
              name="endAt"
              defaultValue={values.endAt}
              required
              aria-invalid={Boolean(errors.endAt)}
            />
          </Field>
        </FormRow>

        <Field
          label="Registration closes"
          htmlFor={`${uid}-deadline`}
          required
          error={errors.registrationDeadline?.[0]}
          hint={
            deadlineLocked
              ? "Frozen — the draw pool has been locked."
              : "Must be before the event starts. The form refuses a later date."
          }
        >
          <Input
            id={`${uid}-deadline`}
            type="datetime-local"
            name="registrationDeadline"
            defaultValue={values.registrationDeadline}
            required
            disabled={deadlineLocked}
            aria-invalid={Boolean(errors.registrationDeadline)}
          />
        </Field>

        <FormRow>
          <Field label="Location name" htmlFor={`${uid}-locationName`} required error={errors.locationName?.[0]}>
            <Input
              id={`${uid}-locationName`}
              name="locationName"
              defaultValue={values.locationName}
              required
              maxLength={160}
              placeholder="DEU Main Hall"
            />
          </Field>
          <Field
            label="Street address"
            htmlFor={`${uid}-locationAddress`}
            optional
            error={errors.locationAddress?.[0]}
          >
            <Input
              id={`${uid}-locationAddress`}
              name="locationAddress"
              defaultValue={values.locationAddress}
              maxLength={240}
            />
          </Field>
        </FormRow>

        <FormRow>
          <Field
            label="Capacity"
            htmlFor={`${uid}-capacity`}
            optional
            error={errors.capacity?.[0]}
            hint="Leave blank for no limit."
          >
            <Input
              id={`${uid}-capacity`}
              type="number"
              name="capacity"
              defaultValue={values.capacity}
              min={1}
              max={100000}
            />
          </Field>
          <Field
            label="Status"
            htmlFor={`${uid}-status`}
            required
            error={errors.status?.[0]}
            hint="Only PUBLISHED shows the event publicly."
          >
            <Select id={`${uid}-status`} name="status" defaultValue={values.status} required>
              {EVENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] ?? status}
                </option>
              ))}
            </Select>
          </Field>
        </FormRow>
      </section>

      {/* ---------------- organiser ---------------- */}
      <section className="space-y-5 border-t border-slate-100 pt-6">
        <h3 className="font-display text-base font-extrabold text-leaf-950">Organiser contact</h3>
        <p className="-mt-2 text-sm text-slate-600">
          Shown on the event page so participants know who to ask. Not shown on participant records
          exported to CSV.
        </p>

        <Field
          label="Organiser name"
          htmlFor={`${uid}-organizerName`}
          required
          error={errors.organizerName?.[0]}
        >
          <Input
            id={`${uid}-organizerName`}
            name="organizerName"
            defaultValue={values.organizerName}
            required
            maxLength={120}
          />
        </Field>

        <FormRow>
          <Field
            label="Department or team"
            htmlFor={`${uid}-organizerDepartment`}
            optional
            error={errors.organizerDepartment?.[0]}
          >
            <Input
              id={`${uid}-organizerDepartment`}
              name="organizerDepartment"
              defaultValue={values.organizerDepartment}
              maxLength={120}
              placeholder="Student Union"
            />
          </Field>
          <Field
            label="Contact e-mail or phone"
            htmlFor={`${uid}-organizerContact`}
            optional
            error={errors.organizerContact?.[0]}
          >
            <Input
              id={`${uid}-organizerContact`}
              name="organizerContact"
              defaultValue={values.organizerContact}
              maxLength={160}
              placeholder="union@deu.ac.kr"
            />
          </Field>
        </FormRow>
      </section>

      {/* ---------------- draw rules ---------------- */}
      <section className="space-y-5 border-t border-slate-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-extrabold text-leaf-950">Draw rules</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
          </Button>
        </div>

        <p className="-mt-2 flex items-start gap-2 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            These become the published rules. Participants see the same wording on the rules page, so
            anything you change here is a commitment.
          </span>
        </p>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              name="requireParticipationForEligibility"
              defaultChecked={values.settings.requireParticipationForEligibility}
              disabled={drawRulesLocked}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">
                Attendance must be confirmed before entering the draw
              </span>
              <span className="block text-xs text-slate-600">
                Strongly recommended. Without it, anyone who registers but never shows up can win.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <Checkbox
              name="allowMultipleWinsPerParticipant"
              defaultChecked={values.settings.allowMultipleWinsPerParticipant}
              disabled={drawRulesLocked}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">
                A participant may win more than one prize
              </span>
              <span className="block text-xs text-slate-600">
                Off by default — one winner per event is the fairer arrangement.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <Checkbox
              name="requireDrawConsent"
              defaultChecked={values.settings.requireDrawConsent}
              disabled={drawRulesLocked}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">
                Require a separate lucky draw consent box
              </span>
              <span className="block text-xs text-slate-600">
                Participants who do not tick it are excluded from the pool.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <Checkbox name="requireEmergencyContact" defaultChecked={values.settings.requireEmergencyContact} />
            <span>
              <span className="block text-sm font-bold text-slate-800">
                Ask for an emergency contact on the form
              </span>
              <span className="block text-xs text-slate-600">
                Off by default — collecting more than we need is the wrong default.
              </span>
            </span>
          </label>
        </div>

        {drawRulesLocked ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            The three rules above are frozen because the draw pool has been locked.
          </p>
        ) : null}

        <FormRow>
          <Field
            label="Winner name display"
            htmlFor={`${uid}-displayMode`}
            hint="Masked shows “Min*** K”. None shows the entry number only."
          >
            <Select
              id={`${uid}-displayMode`}
              name="winnerDisplayMode"
              defaultValue={values.settings.winnerDisplayMode}
            >
              <option value="MASKED">Masked name (e.g. Min*** K)</option>
              <option value="NONE">Entry number only</option>
            </Select>
          </Field>
          <Field
            label="Prize claim window (days)"
            htmlFor={`${uid}-claimWindow`}
            error={errors.claimWindowDays?.[0]}
            hint="How long a winner has to collect before the prize is reissued."
          >
            <Input
              id={`${uid}-claimWindow`}
              type="number"
              name="claimWindowDays"
              defaultValue={values.settings.claimWindowDays}
              min={1}
              max={365}
            />
          </Field>
        </FormRow>

        {showAdvanced ? (
          <div className="space-y-5 rounded-2xl border border-slate-200 p-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3">
                <Checkbox name="publicWinnersVisible" defaultChecked={values.settings.publicWinnersVisible} />
                <span>
                  <span className="block text-sm font-bold text-slate-800">Publish winners publicly</span>
                  <span className="block text-xs text-slate-600">Shows /winners to everyone.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <Checkbox
                  name="publicDrawScreenVisible"
                  defaultChecked={values.settings.publicDrawScreenVisible}
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Publish the live draw screen
                  </span>
                  <span className="block text-xs text-slate-600">
                    Off if you want to run the draw in the organiser area only.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <Checkbox name="showParticipantCount" defaultChecked={values.settings.showParticipantCount} />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Show the participant count publicly
                  </span>
                  <span className="block text-xs text-slate-600">
                    Off hides how many people registered.
                  </span>
                </span>
              </label>
            </div>

            <Field
              label="Prize claim note"
              htmlFor={`${uid}-claimNote`}
              optional
              error={errors.prizeClaimNote?.[0]}
              hint="Extra instructions shown on the winners page, e.g. collection desk hours."
            >
              <Textarea
                id={`${uid}-claimNote`}
                name="prizeClaimNote"
                defaultValue={values.settings.prizeClaimNote}
                rows={3}
                maxLength={2000}
              />
            </Field>

            <Field
              label="How winners are contacted"
              htmlFor={`${uid}-contactMethod`}
              optional
              error={errors.winnerContactMethod?.[0]}
              hint="Published so participants know what to expect."
            >
              <Input
                id={`${uid}-contactMethod`}
                name="winnerContactMethod"
                defaultValue={values.settings.winnerContactMethod}
                maxLength={500}
              />
            </Field>

            <Field
              label="Compliance note"
              htmlFor={`${uid}-compliance`}
              optional
              error={errors.complianceNote?.[0]}
              hint="Shown in the admin area as a reminder. Internal only."
            >
              <Textarea
                id={`${uid}-compliance`}
                name="complianceNote"
                defaultValue={values.settings.complianceNote}
                rows={3}
                maxLength={2000}
              />
            </Field>
          </div>
        ) : null}
      </section>

      {/* ---------------- demo + submit ---------------- */}
      <section className="space-y-4 border-t border-slate-100 pt-6">
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Checkbox name="isDemo" defaultChecked={values.isDemo} />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-extrabold text-amber-900">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              This is demo data
            </span>
            <span className="mt-0.5 block text-xs text-amber-800">
              Demo events are banner-flagged everywhere and can be reset for a rehearsal. Real events
              can never be reset.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <>
                <Spinner label="" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                {mode === "create" ? "Create event" : "Save changes"}
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500">
            Saved changes are written to the audit log with their before and after values.
          </p>
        </div>
      </section>
    </form>
  );
}
