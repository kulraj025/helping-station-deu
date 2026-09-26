/**
 * Participation number (entry number) helpers.
 *
 * Entry numbers are human friendly and unique per event: `HS-0247`.
 * In demo mode they are clearly marked: `HS-DEMO-001`.
 */
import {
  DEMO_ENTRY_NUMBER_PREFIX,
  ENTRY_NUMBER_PAD,
  ENTRY_NUMBER_PREFIX,
} from "./constants";

export function padEntryNumber(sequence: number, demo = false): string {
  const prefix = demo ? DEMO_ENTRY_NUMBER_PREFIX : ENTRY_NUMBER_PREFIX;
  return `${prefix}${String(sequence).padStart(ENTRY_NUMBER_PAD, "0")}`;
}

export function isDemoEntryNumber(entryNumber: string): boolean {
  return entryNumber.startsWith(DEMO_ENTRY_NUMBER_PREFIX);
}

export function extractSequence(entryNumber: string): number | null {
  const digits = entryNumber.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Next free sequence number for an event.
 *
 * @param existingNumbers every entry number already used in the event
 */
export function nextEntryNumber(existingNumbers: readonly string[], demo = false): string {
  const highest = existingNumbers.reduce((max, value) => {
    const sequence = extractSequence(value);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);
  return padEntryNumber(highest + 1, demo);
}

/** Group digits for the reveal animation: "HS-0247" -> ["HS", "0247"] */
export function splitEntryNumber(entryNumber: string): [string, string] {
  const index = entryNumber.indexOf("-");
  if (index === -1) return [entryNumber, ""];
  return [entryNumber.slice(0, index + 1), entryNumber.slice(index + 1)];
}
