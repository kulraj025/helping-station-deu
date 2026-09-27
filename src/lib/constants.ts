/**
 * Domain constants.
 *
 * Statuses are stored as strings in PostgreSQL and validated by Zod against the
 * arrays below, so the database never receives an unknown value.
 */

export const ROLES = ["STUDENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const REGISTRATION_STATUSES = ["CONFIRMED", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const PARTICIPATION_STATUSES = [
  "REGISTERED",
  "PARTICIPATED",
  "NO_SHOW",
  "EXCUSED",
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const ELIGIBILITY_STATUSES = ["PENDING", "ELIGIBLE", "INELIGIBLE"] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const DRAW_STATUSES = ["LOCKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type DrawStatus = (typeof DRAW_STATUSES)[number];

export const CLAIM_STATUSES = ["PENDING", "NOTIFIED", "CLAIMED", "UNCLAIMED", "REVOKED"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value);
}

export const CORRECTION_TYPES = ["REVOKE_WINNER", "ANNOTATE", "REISSUE"] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "FAILED", "SKIPPED"] as const;
export const NOTIFICATION_TYPES = [
  "REGISTRATION_CONFIRMED",
  "EVENT_REMINDER",
  "PARTICIPATION_CONFIRMED",
  "WINNER_NOTIFIED",
  "PRIZE_CLAIM_INSTRUCTIONS",
] as const;

/** Entry numbers shown in public places: HS-0247 */
export const ENTRY_NUMBER_PREFIX = "HS-";
/** Demo-mode entry numbers: HS-DEMO-001 */
export const DEMO_ENTRY_NUMBER_PREFIX = "HS-DEMO-";
export const ENTRY_NUMBER_PAD = 4;

export const APP_NAME = "Helping Station DEU";
export const APP_TAGLINE = "Serving Beyond Borders — Together We Grow.";

/**
 * Shortest password a person may choose.
 *
 * Deliberately length-only: no upper-case, lower-case or digit requirement.
 * This is a low-stakes volunteer sign-up, and the people most likely to be
 * setting a password are doing it on a phone in a queue. A composition rule
 * pushes people towards `Password1!`, which is far weaker than a long
 * passphrase, so length is the only rule enforced.
 *
 * Changing this changes what people may set, so the login schemas must accept
 * anything at least this long — see `adminLoginSchema` in `src/lib/validation.ts`.
 */
export const PASSWORD_MIN_LENGTH = 6;

export const VOLUNTEER_ROLES = [
  "Clean-up team",
  "Recycling & waste separation",
  "Poster & design team",
  "Awareness booth",
  "Community outreach",
  "Logistics & setup",
  "Photography / media",
  "No preference",
] as const;

export const DEPARTMENTS = [
  "Software Engineering",
  "Computer Engineering",
  "Business Administration",
  "Digital Marketing",
  "International Trade",
  "Hospitality & Tourism",
  "Visual Design",
  "Mechanical Engineering",
  "Architectural Engineering",
  "Economics",
  "Law",
  "Nursing",
  "Other",
] as const;

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Registration open",
  REGISTRATION_CLOSED: "Registration closed",
  IN_PROGRESS: "Event in progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const PARTICIPATION_LABELS: Record<ParticipationStatus, string> = {
  REGISTERED: "Registered",
  PARTICIPATED: "Participated",
  NO_SHOW: "No show",
  EXCUSED: "Excused",
};

export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  PENDING: "Not confirmed",
  ELIGIBLE: "Eligible for draw",
  INELIGIBLE: "Not eligible",
};

export const CLAIM_LABELS: Record<ClaimStatus, string> = {
  PENDING: "Awaiting contact",
  NOTIFIED: "Notified",
  CLAIMED: "Prize claimed",
  UNCLAIMED: "Not collected",
  REVOKED: "Revoked",
};

/**
 * Human labels for the dotted audit action names.
 *
 * The stored names stay machine-readable; this is only for display, so the log
 * reads as sentences rather than as identifiers.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "registration.created": "Registration created",
  "registration.duplicate_blocked": "Duplicate registration blocked",
  "registration.cancelled": "Registration cancelled",
  "registration.participation_verified": "Attendance confirmed",
  "registration.eligibility_changed": "Eligibility changed",
  "registration.eligibility_bulk_changed": "Eligibility changed in bulk",
  "event.created": "Event created",
  "event.updated": "Event updated",
  "event.status_changed": "Event status changed",
  "prizes.configured": "Prize added",
  "prize.updated": "Prize updated",
  "prize.deleted": "Prize deleted",
  "draw.pool_locked": "Participant pool locked",
  "draw.started": "Draw started",
  "draw.completed": "Draw completed",
  "draw.integrity_verified": "Draw integrity verified",
  "draw.failed": "Draw failed",
  "draw.test_reset": "Rehearsal draw reset",
  "winner.claim_updated": "Winner claim status updated",
  "winner.revoked": "Winner revoked",
  "winner.annotated": "Winner annotated",
  "winner.notified": "Winner notification queued",
  "report.exported": "Data exported",
  "auth.admin_login": "Organiser signed in",
  "auth.admin_bootstrapped": "First organiser account created",
  "admin.site_settings_changed": "Site section switches changed",
  "admin.user_deleted": "Participant account deleted",
  "admin.all_participants_deleted": "All participant accounts deleted",
  "event.qr_downloaded": "QR code downloaded",
  "event.poster_downloaded": "Poster downloaded",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}
export function isParticipationStatus(value: string): value is ParticipationStatus {
  return (PARTICIPATION_STATUSES as readonly string[]).includes(value);
}
export function isEligibilityStatus(value: string): value is EligibilityStatus {
  return (ELIGIBILITY_STATUSES as readonly string[]).includes(value);
}
