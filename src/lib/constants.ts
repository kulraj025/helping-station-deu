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
