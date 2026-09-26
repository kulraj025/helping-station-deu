"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Search, X } from "lucide-react";
import {
  EligibilityBadge,
  ParticipationBadge,
  RegistrationBadge,
  Badge,
} from "@/components/ui/badge";
import { FormAlert, Input, Select } from "@/components/ui/input";
import { TableShell, Td, Th, Tr } from "@/components/ui/feedback";
import { ELIGIBILITY_STATUSES, PARTICIPATION_STATUSES } from "@/lib/constants";
import { updateParticipantAction } from "@/server/actions/admin-participants";
import { initialParticipantState, type ParticipantActionState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/format";

export interface AdminParticipant {
  id: string;
  entryNumber: string;
  name: string;
  maskedStudentId: string;
  department: string;
  emailDomain: string;
  participationStatus: string;
  drawEligibility: string;
  registrationStatus: string;
  volunteerRole: string | null;
  createdAt: string;
  verifiedAt: string | null;
  publicDisplayConsent: boolean;
  hasDrawConsent: boolean;
  isAcademicEmail: boolean;
  isDemo: boolean;
  hasWon: boolean;
}

const LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  WAITLISTED: "Waitlisted",
  PARTICIPATED: "Took part",
  NO_SHOW: "No-show",
  PENDING_REVIEW: "Pending review",
  ELIGIBLE: "Eligible",
  INELIGIBLE: "Ineligible",
  EXCLUDED: "Excluded",
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Save this participant"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-leaf-700 px-3 text-xs font-bold text-white transition hover:bg-leaf-800 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Save
    </button>
  );
}

/** Per-row editor: two selects and a reason box. */
function RowEditor({
  participant,
  locked,
}: {
  participant: AdminParticipant;
  locked: boolean;
}) {
  const [state, formAction] = useActionState<ParticipantActionState, FormData>(
    updateParticipantAction,
    initialParticipantState,
  );

  if (locked) {
    return (
      <span className="text-xs text-slate-400">Locked</span>
    );
  }

  return (
    <form action={formAction} className="min-w-[15rem] space-y-2">
      <input type="hidden" name="registrationId" value={participant.id} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`part-${participant.id}`}>
          Participation status for {participant.entryNumber}
        </label>
        <Select
          id={`part-${participant.id}`}
          name="participationStatus"
          defaultValue={participant.participationStatus}
          className="h-8 w-36 py-0 text-xs"
        >
          {PARTICIPATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LABELS[status] ?? status}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor={`elig-${participant.id}`}>
          Draw eligibility for {participant.entryNumber}
        </label>
        <Select
          id={`elig-${participant.id}`}
          name="drawEligibility"
          defaultValue={participant.drawEligibility}
          className="h-8 w-36 py-0 text-xs"
        >
          {ELIGIBILITY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LABELS[status] ?? status}
            </option>
          ))}
        </Select>
        <SaveButton />
      </div>
      <details className="group">
        <summary className="cursor-pointer list-none text-[0.7rem] font-semibold text-slate-500 hover:text-leaf-700">
          + reason
        </summary>
        <Input
          name="reason"
          placeholder="Why (recorded in the audit log)"
          maxLength={300}
          className="mt-1.5 h-8 text-xs"
        />
      </details>
      {state.status === "error" && state.message ? (
        <p className="text-[0.7rem] font-semibold text-red-600">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-[0.7rem] font-semibold text-leaf-700">Saved</p>
      ) : null}
    </form>
  );
}

/**
 * Participant table with inline eligibility editing.
 *
 * Masked student IDs and e-mail domains only — the full record is a deliberate
 * extra click, so browsing the list cannot casually expose contact details.
 */
export function ParticipantTable({
  participants,
  locked,
}: {
  participants: AdminParticipant[];
  locked: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return participants.filter((participant) => {
      if (cancelled && participant.registrationStatus === "CANCELLED") return false;
      if (needle === "") return true;
      return (
        participant.name.toLowerCase().includes(needle) ||
        participant.entryNumber.toLowerCase().includes(needle) ||
        participant.department.toLowerCase().includes(needle) ||
        participant.maskedStudentId.toLowerCase().includes(needle)
      );
    });
  }, [participants, filter, cancelled]);

  if (participants.length === 0) {
    return (
      <FormAlert tone="info">
        No participants match these filters. Registrations appear here as soon as somebody signs up.
      </FormAlert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by name, entry number, department…"
            aria-label="Filter participants"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={cancelled}
            onChange={(event) => setCancelled(event.target.checked)}
            className="h-4 w-4 rounded border-2 border-slate-300 accent-leaf-600"
          />
          Hide cancelled
        </label>
        <span className="text-sm text-slate-500">
          {visible.length} of {participants.length}
        </span>
      </div>

      {locked ? (
        <FormAlert tone="warning" title="Pool locked">
          Eligibility is frozen into the draw snapshot, so these rows cannot be edited. Use the
          winners page to record a correction instead.
        </FormAlert>
      ) : null}

      <TableShell className="rounded-xl border border-slate-200">
        <thead>
          <tr>
            <Th>Entry</Th>
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>Registration</Th>
            <Th>Participation</Th>
            <Th>Eligibility</Th>
            <Th>Consent</Th>
            <Th>Update</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((participant) => (
            <Tr key={participant.id}>
              <Td>
                <span className="font-mono text-xs font-bold text-leaf-800">
                  {participant.entryNumber}
                </span>
                <span className="mt-0.5 block text-[0.7rem] text-slate-400">
                  {formatDateTime(participant.createdAt)}
                </span>
              </Td>
              <Td>
                <span className="font-semibold text-slate-800">{participant.name}</span>
                <span className="mt-0.5 block font-mono text-[0.7rem] text-slate-400">
                  {participant.maskedStudentId}
                </span>
                {participant.volunteerRole ? (
                  <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                    {participant.volunteerRole}
                  </span>
                ) : null}
              </Td>
              <Td>
                <span className="text-sm text-slate-700">{participant.department}</span>
                <span className="mt-0.5 block text-[0.7rem] text-slate-400">
                  @{participant.emailDomain}
                </span>
              </Td>
              <Td>
                <RegistrationBadge status={participant.registrationStatus} />
                {participant.isDemo ? (
                  <Badge tone="gold" className="ml-1">
                    Demo
                  </Badge>
                ) : null}
                {!participant.isAcademicEmail ? (
                  <span
                    className="mt-1 block text-[0.65rem] font-semibold text-amber-700"
                    title="Not a recognised academic e-mail domain"
                  >
                    Non-academic e-mail
                  </span>
                ) : null}
              </Td>
              <Td>
                <ParticipationBadge status={participant.participationStatus} />
              </Td>
              <Td>
                <EligibilityBadge status={participant.drawEligibility} />
                {participant.hasWon ? (
                  <Badge tone="gold" className="ml-1">
                    Won
                  </Badge>
                ) : null}
              </Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={participant.hasDrawConsent ? "leaf" : "slate"}>
                    {participant.hasDrawConsent ? "Draw" : "No draw"}
                  </Badge>
                  <span
                    title={
                      participant.publicDisplayConsent
                        ? "Name may appear masked on the winners page"
                        : "Name withheld from the public winners page"
                    }
                  >
                    <Badge tone={participant.publicDisplayConsent ? "azure" : "slate"}>
                      {participant.publicDisplayConsent ? "Listed" : "Hidden"}
                    </Badge>
                  </span>
                </span>
              </Td>
              <Td>
                <RowEditor participant={participant} locked={locked} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>

      {visible.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <X className="h-4 w-4" aria-hidden="true" />
          Nothing matches that filter.
        </p>
      ) : null}
    </div>
  );
}


