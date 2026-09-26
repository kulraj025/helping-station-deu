/**
 * Per-event configuration, stored as JSON on `Event.settings`.
 *
 * Keeping the rules in the database (instead of code) is what makes the rules
 * page and the draw behaviour configurable by an organiser without a deploy.
 */
import { z } from "zod";

export const WINNER_DISPLAY_MODES = ["MASKED", "NONE"] as const;
export type WinnerDisplayMode = (typeof WINNER_DISPLAY_MODES)[number];

export const eventSettingsSchema = z.object({
  /** A registration alone is not enough — an organiser must confirm attendance. */
  requireParticipationForEligibility: z.boolean().default(true),
  /** A participant may win more than one prize in the same event. */
  allowMultipleWinsPerParticipant: z.boolean().default(false),
  /** MASKED = "Min*** K", NONE = entry number only. */
  winnerDisplayMode: z.enum(WINNER_DISPLAY_MODES).default("MASKED"),
  /** Publish winners on /winners. */
  publicWinnersVisible: z.boolean().default(true),
  /** Publish the live draw screen on /draw. */
  publicDrawScreenVisible: z.boolean().default(true),
  /** Show the registered participant count on public pages. */
  showParticipantCount: z.boolean().default(true),
  /** Days a winner has to collect the prize before it is reallocated. */
  claimWindowDays: z.number().int().min(1).max(365).default(14),
  /** Require the separate "lucky draw consent" checkbox. */
  requireDrawConsent: z.boolean().default(true),
  /** Ask for an emergency contact (off by default — data minimisation). */
  requireEmergencyContact: z.boolean().default(false),
  /** Extra organiser note rendered on the rules page. */
  prizeClaimNote: z.string().max(2000).default(""),
  /** How winners are contacted. */
  winnerContactMethod: z.string().max(500).default(
    "The organiser contacts each winner using the e-mail address and phone number collected at registration.",
  ),
  /** Legal reminder shown in the admin UI. */
  complianceNote: z.string().max(2000).default(
    "This activity is a free appreciation draw for event participants. It is not gambling and no money is ever paid to enter. The organiser confirms that any prize or paid-entry mechanism complies with applicable university and local regulations before launch.",
  ),
});

export type EventSettings = z.infer<typeof eventSettingsSchema>;

export const DEFAULT_EVENT_SETTINGS: EventSettings = eventSettingsSchema.parse({});

/** Safely parse the JSON column, falling back to defaults. */
export function parseEventSettings(value: unknown): EventSettings {
  if (value === null || value === undefined) return DEFAULT_EVENT_SETTINGS;
  const result = eventSettingsSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_EVENT_SETTINGS;
}
