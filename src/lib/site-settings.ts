/**
 * Site-wide section switches: the pure part.
 *
 * Deliberately separate from `server/services/site-settings-service.ts`, which
 * holds the database access. Two reasons, one practical and one structural:
 *
 *  - Practically, the labels, paths and schema here are needed by client
 *    components (the admin panel renders the section list) and by unit tests,
 *    and `server-only` makes a module unimportable from both. Marking this file
 *    as anything other than plain data would be claiming a constraint it does
 *    not have.
 *  - Structurally, the list of sections and the way to read them are different
 *    kinds of thing. The list changes when a section is added; the read changes
 *    when storage does. Keeping them apart means a database swap does not touch
 *    the section list, and a new section does not touch the database.
 *
 * Nothing in this file touches the database or `process.env`, so it is safe to
 * import from anywhere.
 */
import { z } from "zod";

/**
 * The sections an organiser can close.
 *
 * `key` is the settings column itself, not a separate short identifier. That is
 * deliberate: an earlier version used `register` and mapped it to `registerOpen`
 * at read time, which is exactly the kind of indirection that produces a silent
 * `undefined` the day one of the two is renamed. Using the column name as the
 * key means a mismatch is a compile error or a failing test instead.
 *
 * Kept as data rather than as booleans scattered through the app so that the
 * admin screen, the public gate and the docs all describe the same list. Adding a
 * section means adding it here and checking it in the relevant page.
 */
export const SITE_SECTIONS = [
  {
    key: "registerOpen",
    label: "Registration",
    path: "/register",
    /** Shown in the admin screen so the switch is self-explanatory. */
    hint: "The sign-up form. Turning this off stops new registrations but keeps every existing participant's account working.",
  },
  {
    key: "winnersOpen",
    label: "Winners",
    path: "/winners",
    hint: "The public winners list. Use this to hold results back until you are ready to announce them.",
  },
  {
    key: "drawOpen",
    label: "Live draw",
    path: "/draw",
    hint: "The draw screen shown on a projector, and the public draw page.",
  },
  {
    key: "rulesOpen",
    label: "Rules",
    path: "/rules",
    hint: "The rules and eligibility page. Closing this hides the explanation of how the draw works.",
  },
] as const;

/** A switch that decides whether a public section is open. */
export type SiteSectionKey = (typeof SITE_SECTIONS)[number]["key"];

/** The subset of switches a visitor-facing page reads. */
export interface SiteSettingsShape {
  siteOpen: boolean;
  registerOpen: boolean;
  winnersOpen: boolean;
  drawOpen: boolean;
  rulesOpen: boolean;
  showCount: boolean;
  closedNote: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/**
 * Everything open.
 *
 * This is both the shape a fresh install gets and the value returned when the
 * settings cannot be read. The second use is the important one: a missing table
 * or a failed query must leave the public site open rather than take itself
 * offline, because "no opinion" should never mean "closed".
 */
export const OPEN_SETTINGS: SiteSettingsShape = {
  siteOpen: true,
  registerOpen: true,
  winnersOpen: true,
  drawOpen: true,
  rulesOpen: true,
  showCount: true,
  closedNote: "",
  updatedBy: null,
  updatedAt: null,
};

/** What the admin form may change. Validated before it reaches the database. */
export const siteSettingsInputSchema = z.object({
  siteOpen: z.boolean(),
  registerOpen: z.boolean(),
  winnersOpen: z.boolean(),
  drawOpen: z.boolean(),
  rulesOpen: z.boolean(),
  showCount: z.boolean(),
  closedNote: z.string().trim().max(300, "Keep the note under 300 characters"),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsInputSchema>;

/** Human-readable names, for audit messages the organiser will read later. */
export const SITE_SWITCH_LABELS: Record<string, string> = {
  siteOpen: "the whole site",
  registerOpen: "registration",
  winnersOpen: "winners",
  drawOpen: "the live draw",
  rulesOpen: "the rules",
  showCount: "the participant count",
};

export function prettySwitchLabel(key: string): string {
  return SITE_SWITCH_LABELS[key] ?? key;
}
