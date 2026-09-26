import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CLAIM_STATUSES,
  ELIGIBILITY_STATUSES,
  EVENT_STATUSES,
  PARTICIPATION_STATUSES,
  type ClaimStatus,
  type EligibilityStatus,
  type EventStatus,
  type ParticipationStatus,
} from "@/lib/constants";

type Tone = "leaf" | "azure" | "gold" | "slate" | "red" | "violet";

const tones: Record<Tone, string> = {
  leaf: "bg-leaf-100 text-leaf-800 ring-leaf-600/20",
  azure: "bg-azure-100 text-azure-600 ring-azure-500/20",
  gold: "bg-gold-300/40 text-gold-600 ring-gold-500/25",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  red: "bg-red-100 text-red-700 ring-red-600/20",
  violet: "bg-violet-100 text-violet-700 ring-violet-600/20",
};

export function Badge({
  tone = "slate",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const participationMap: Record<ParticipationStatus, { label: string; tone: Tone }> = {
  REGISTERED: { label: "Registered", tone: "slate" },
  PARTICIPATED: { label: "Participated", tone: "leaf" },
  NO_SHOW: { label: "No show", tone: "red" },
  EXCUSED: { label: "Excused", tone: "gold" },
};

const eligibilityMap: Record<EligibilityStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Not confirmed", tone: "gold" },
  ELIGIBLE: { label: "Eligible ✓", tone: "leaf" },
  INELIGIBLE: { label: "Not eligible", tone: "red" },
};

const eventMap: Record<EventStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  PUBLISHED: { label: "Registration open", tone: "leaf" },
  REGISTRATION_CLOSED: { label: "Registration closed", tone: "gold" },
  IN_PROGRESS: { label: "In progress", tone: "azure" },
  COMPLETED: { label: "Completed", tone: "violet" },
  ARCHIVED: { label: "Archived", tone: "slate" },
};

const claimMap: Record<ClaimStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Awaiting contact", tone: "gold" },
  NOTIFIED: { label: "Notified", tone: "azure" },
  CLAIMED: { label: "Prize claimed", tone: "leaf" },
  UNCLAIMED: { label: "Not collected", tone: "slate" },
  REVOKED: { label: "Revoked", tone: "red" },
};

/**
 * Status is never communicated by colour alone: every badge carries a text
 * label (and most carry a symbol such as ✓ or ✕).
 */
export function ParticipationBadge({ status }: { status: string }) {
  const key = (PARTICIPATION_STATUSES as readonly string[]).includes(status)
    ? (status as ParticipationStatus)
    : "REGISTERED";
  const { label, tone } = participationMap[key];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function EligibilityBadge({ status }: { status: string }) {
  const key = (ELIGIBILITY_STATUSES as readonly string[]).includes(status)
    ? (status as EligibilityStatus)
    : "PENDING";
  const { label, tone } = eligibilityMap[key];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const key = (EVENT_STATUSES as readonly string[]).includes(status) ? (status as EventStatus) : "DRAFT";
  const { label, tone } = eventMap[key];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function ClaimBadge({ status }: { status: string }) {
  const key = (CLAIM_STATUSES as readonly string[]).includes(status) ? (status as ClaimStatus) : "PENDING";
  const { label, tone } = claimMap[key];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function RegistrationBadge({ status }: { status: string }) {
  const cancelled = status !== "CONFIRMED";
  return (
    <Badge tone={cancelled ? "red" : "leaf"} dot>
      {cancelled ? "Cancelled" : "Confirmed"}
    </Badge>
  );
}

export { tones as badgeTones };
