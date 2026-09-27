"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ExternalLink, Save, Trash2, TriangleAlert, UserRound, Users } from "lucide-react";
import {
  deleteAllParticipantsAction,
  deleteUserAction,
  updateSiteSettingsAction,
} from "@/server/actions/admin-controls";
import { initialAdminState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/feedback";

/**
 * One row per account, with the delete control.
 *
 * Each delete is a separate `<form>` rather than one form with a hidden field,
 * so the button that deletes somebody is the button you clicked — no shared
 * state to get out of step with the row it belongs to.
 */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isDemo: boolean;
  createdAt: string;
  registrations: number;
}

function Submit({ label, pendingLabel, variant = "primary" }: {
  label: React.ReactNode;
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

/** Toggles for the public sections, plus the site-wide kill switch. */
export function SectionSwitches({
  settings,
}: {
  settings: {
    siteOpen: boolean;
    registerOpen: boolean;
    winnersOpen: boolean;
    drawOpen: boolean;
    rulesOpen: boolean;
    showCount: boolean;
    closedNote: string;
  };
}) {
  const [state, formAction] = useActionState(updateSiteSettingsAction, initialAdminState);
  // Live preview of what closing the site would do, before anyone saves.
  const [note, setNote] = useState(settings.closedNote);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "success" ? (
        <FormAlert tone="success" title="Saved">
          {state.message}
        </FormAlert>
      ) : state.status === "error" ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      <Switch
        name="siteOpen"
        defaultChecked={settings.siteOpen}
        label="Site open"
        description="The master switch. Turning this off closes every public page at once, for maintenance or a closed season. Organiser pages keep working."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Switch
          name="registerOpen"
          defaultChecked={settings.registerOpen}
          label="Registration"
          description="The sign-up form. Closed, nobody new can register; existing accounts still work."
        />
        <Switch
          name="winnersOpen"
          defaultChecked={settings.winnersOpen}
          label="Winners"
          description="The public winners list. Use it to hold results back until you announce them."
        />
        <Switch
          name="drawOpen"
          defaultChecked={settings.drawOpen}
          label="Live draw"
          description="The draw screen, including the projector view."
        />
        <Switch
          name="rulesOpen"
          defaultChecked={settings.rulesOpen}
          label="Rules"
          description="The rules and eligibility page."
        />
      </div>

      <Switch
        name="showCount"
        defaultChecked={settings.showCount}
        label="Show the participant count"
        description="Whether the number of registered participants appears on public pages."
      />

      <Field
        label="Note shown on closed pages"
        htmlFor="closedNote"
        optional
        hint="Optional. Shown to visitors on any closed page — useful for saying when something reopens."
        error={state.fieldErrors?.closedNote?.[0]}
      >
        <Input
          id="closedNote"
          name="closedNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="Back on Monday"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Submit
          label={
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save switches
            </>
          }
          pendingLabel="Saving…"
        />
        {note ? (
          <p className="text-xs text-slate-500">
            Preview: <span className="font-semibold text-slate-700">{note}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Live links to each section, so a switch can be checked from the same screen. */
export function SectionLinks({
  sections,
}: {
  sections: Array<{ key: string; label: string; path: string; open: boolean }>;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {sections.map((section) => (
        <li key={section.key}>
          <Link
            href={section.path}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-800">
                {section.label}
              </span>
              <span className="block truncate font-mono text-xs text-slate-500">
                {section.path}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={
                  section.open
                    ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"
                    : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600"
                }
              >
                {section.open ? "Open" : "Closed"}
              </span>
              <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The account list, with a delete button per row. */
export function UserList({ users, currentAdminId }: { users: UserRow[]; currentAdminId: string }) {
  const [state, formAction] = useActionState(deleteUserAction, initialAdminState);

  if (users.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        There are no accounts yet. They appear here as soon as somebody registers or signs in.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state.status === "success" ? (
        <FormAlert tone="success" title="Deleted">
          {state.message}
        </FormAlert>
      ) : state.status === "error" ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      <ul className="space-y-2">
        {users.map((user) => {
          const isSelf = user.id === currentAdminId;
          const isOrganiser = user.role === "ADMIN";
          return (
            <li
              key={user.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={
                    isOrganiser
                      ? "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700"
                      : "grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                  }
                >
                  {isOrganiser ? (
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {user.name}
                    {isSelf ? (
                      <span className="ml-2 text-xs font-semibold text-slate-500">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-600">{user.email}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {isOrganiser ? "Organiser" : "Participant"}
                    {user.registrations > 0
                      ? ` · ${user.registrations} registration${user.registrations === 1 ? "" : "s"}`
                      : " · no registrations"}
                    {user.isDemo ? " · demo" : ""}
                  </p>
                </div>
              </div>

              <form action={formAction} className="shrink-0">
                <input type="hidden" name="userId" value={user.id} />
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={isSelf}
                  title={isSelf ? "You cannot delete the account you are signed in with" : undefined}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Delete every participant account at once.
 *
 * Behind a typed word, not just a confirm dialog, because there is no undo and
 * the mistake is easy to make on a phone. The dialog only appears once the box
 * is ticked, so the extra step is only paid by someone who has already decided.
 */
export function DeleteAllParticipants({ count }: { count: number }) {
  const [state, formAction] = useActionState(deleteAllParticipantsAction, initialAdminState);
  const [armed, setArmed] = useState(false);

  if (count === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        There are no participant accounts to delete.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.status === "success" ? (
        <FormAlert tone="success" title="Done">
          {state.message}
        </FormAlert>
      ) : state.status === "error" ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div className="min-w-0 text-sm text-red-900">
            <p className="font-extrabold">
              Delete all {count} participant account{count === 1 ? "" : "s"}
            </p>
            <p className="mt-1.5 leading-relaxed">
              This also removes every registration attached to them, and anything derived from
              those registrations — draw entries, winners and corrections. It cannot be undone.
              Organiser accounts, events, prizes and the audit log are kept.
            </p>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-red-900">
          <input
            type="checkbox"
            checked={armed}
            onChange={(event) => setArmed(event.target.checked)}
            className="h-4 w-4"
          />
          Yes, I understand this cannot be undone
        </label>

        {armed ? (
          <form action={formAction} className="mt-4 space-y-3 border-t border-red-200 pt-4">
            <Field label="Type DELETE to confirm" htmlFor="confirm-all">
              <Input
                id="confirm-all"
                name="confirm"
                autoComplete="off"
                placeholder="DELETE"
                className="font-mono"
              />
            </Field>
            <Submit
              label={
                <>
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Delete all participant accounts
                </>
              }
              pendingLabel="Deleting…"
              variant="danger"
            />
          </form>
        ) : null}
      </div>
    </div>
  );
}
