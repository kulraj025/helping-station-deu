"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCheck, Loader2, Users } from "lucide-react";
import { FormAlert, Input, Select } from "@/components/ui/input";
import { TableShell, Td, Th, Tr } from "@/components/ui/feedback";
import { EligibilityBadge, ParticipationBadge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { ELIGIBILITY_STATUSES, PARTICIPATION_STATUSES } from "@/lib/constants";
import { bulkUpdateParticipantsAction } from "@/server/actions/admin-participants";
import { initialParticipantState, type ParticipantActionState } from "@/lib/action-state";

export interface BulkCandidate {
  id: string;
  entryNumber: string;
  name: string;
  department: string;
  participationStatus: string;
  drawEligibility: string;
  hasDrawConsent: boolean;
}

const PARTICIPATION_LABELS: Record<string, string> = {
  PARTICIPATED: "Took part",
  NO_SHOW: "Did not show",
  PENDING_REVIEW: "Not reviewed yet",
};

const ELIGIBILITY_LABELS: Record<string, string> = {
  ELIGIBLE: "Eligible",
  INELIGIBLE: "Ineligible",
  EXCLUDED: "Excluded",
  PENDING_REVIEW: "Not reviewed",
};

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-leaf-700 px-6 text-sm font-extrabold text-white transition hover:bg-leaf-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCheck className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Applying…" : "Apply to selected"}
    </button>
  );
}

/**
 * Bulk eligibility editor.
 *
 * Built around the "all matching" idea: an organiser working through 300
 * people on a paper check-in sheet should not have to tick 300 boxes, but must
 * be able to review exactly who a blanket action will touch before committing.
 */
export function EligibilityPanel({
  eventId,
  candidates,
  locked,
  requireParticipation,
}: {
  eventId: string;
  candidates: BulkCandidate[];
  locked: boolean;
  requireParticipation: boolean;
}) {
  const [state, formAction] = useActionState<ParticipantActionState, FormData>(
    bulkUpdateParticipantsAction,
    initialParticipantState,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [participation, setParticipation] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);

  const visible = useMemo(
    () =>
      showUnreviewedOnly
        ? candidates.filter((candidate) => candidate.participationStatus === "PENDING_REVIEW")
        : candidates,
    [candidates, showUnreviewedOnly],
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((candidate) => selected.has(candidate.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        for (const candidate of visible) next.delete(candidate.id);
        return next;
      }
      const next = new Set(current);
      for (const candidate of visible) next.add(candidate.id);
      return next;
    });
  }

  const noConsentSelected = candidates.filter(
    (candidate) => selected.has(candidate.id) && !candidate.hasDrawConsent,
  );

  if (locked) {
    return (
      <FormAlert tone="warning" title="Pool locked">
        Eligibility is frozen into the draw snapshot. Nothing here can be changed — record a
        correction on the winners page instead.
      </FormAlert>
    );
  }

  return (
    <div className="space-y-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error" title="Nothing was changed">
          {state.message}
        </FormAlert>
      ) : null}
      {state.status === "success" ? (
        <FormAlert tone="success" title="Applied">
          {state.message}
        </FormAlert>
      ) : null}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="eventId" value={eventId} />
        {Array.from(selected).map((id) => (
          <input key={id} type="hidden" name="registrationIds" value={id} />
        ))}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Mark as
            </label>
            <Select
              name="participationStatus"
              value={participation}
              onChange={(event) => setParticipation(event.target.value)}
            >
              <option value="">— leave attendance alone —</option>
              {PARTICIPATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PARTICIPATION_LABELS[status] ?? status}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              And set eligibility to
            </label>
            <Select
              name="drawEligibility"
              value={eligibility}
              onChange={(event) => setEligibility(event.target.value)}
            >
              <option value="">— leave eligibility alone —</option>
              {ELIGIBILITY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ELIGIBILITY_LABELS[status] ?? status}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Reason <span className="font-normal normal-case text-slate-400">(optional, logged)</span>
          </label>
          <Input name="reason" maxLength={300} placeholder="e.g. Check-in sheet, 12 June afternoon" />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <ApplyButton disabled={selected.size === 0 || (!participation && !eligibility)} />
          <span className="text-sm text-slate-600">
            {selected.size} participant{selected.size === 1 ? "" : "s"} selected
            {selected.size > 200 ? " — the limit is 200 per action" : ""}
          </span>
        </div>

        {participation === "PARTICIPATED" && eligibility === "ELIGIBLE" && requireParticipation ? (
          <FormAlert tone="info">
            Marking somebody as having taken part and eligible is the normal path. It is still logged
            individually, so the audit trail shows who decided what.
          </FormAlert>
        ) : null}

        {noConsentSelected.length > 0 && eligibility === "ELIGIBLE" ? (
          <FormAlert tone="warning" title="Some of these never consented to the draw">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {noConsentSelected.length} selected participant(s) did not tick the draw consent box.
                They will be counted as eligible here but excluded when the pool is locked. Ask them
                first, or leave them ineligible.
              </span>
            </span>
          </FormAlert>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={showUnreviewedOnly}
            onChange={(event) => setShowUnreviewedOnly(event.target.checked)}
            className="h-4 w-4 rounded border-2 border-slate-300 accent-leaf-600"
          />
          Only show not-yet-reviewed ({candidates.filter((c) => c.participationStatus === "PENDING_REVIEW").length})
        </label>
        <span className="text-sm text-slate-500">
          Showing {visible.length} of {candidates.length}
        </span>
      </div>

      <TableShell className="rounded-xl border border-slate-200">
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAll}
                aria-label="Select all shown participants"
                className="h-4 w-4 rounded border-2 border-slate-300 accent-leaf-600"
              />
            </Th>
            <Th>Entry</Th>
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>Attendance</Th>
            <Th>Eligibility</Th>
          </tr>
        </thead>
        <tbody>
          {visible.map((candidate) => (
            <Tr key={candidate.id} className={selected.has(candidate.id) ? "bg-leaf-50/60" : undefined}>
              <Td>
                <Checkbox
                  checked={selected.has(candidate.id)}
                  onChange={() => toggle(candidate.id)}
                  aria-label={`Select ${candidate.entryNumber} ${candidate.name}`}
                  className="h-4 w-4"
                />
              </Td>
              <Td>
                <span className="font-mono text-xs font-bold text-leaf-800">
                  {candidate.entryNumber}
                </span>
              </Td>
              <Td>
                <span className="text-sm font-semibold text-slate-800">{candidate.name}</span>
                {!candidate.hasDrawConsent ? (
                  <span className="mt-0.5 block text-[0.65rem] font-semibold text-amber-700">
                    No draw consent
                  </span>
                ) : null}
              </Td>
              <Td className="text-sm text-slate-600">{candidate.department}</Td>
              <Td>
                <ParticipationBadge status={candidate.participationStatus} />
              </Td>
              <Td>
                <EligibilityBadge status={candidate.drawEligibility} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>

      {visible.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Users className="h-4 w-4" aria-hidden="true" />
          {candidates.length === 0
            ? "No confirmed participants yet."
            : "Everybody here has been reviewed already."}
        </p>
      ) : null}
    </div>
  );
}
