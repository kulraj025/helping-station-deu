import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * URL-safe slug from a human title.
 *
 * Keeps letters and digits from any script (so a Korean or Japanese event name
 * still produces a readable URL) and collapses everything else into hyphens.
 */
export function slugify(value: string, maxLength = 80): string {
  const slug = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "event";
}

/**
 * The word an organiser must type before an irreversible step.
 *
 * Derived from the event slug, so it is something they can read off the screen
 * rather than memorise, and two events never share it. This lives outside the
 * `"use server"` action module on purpose: a server-actions file may only export
 * async functions, and this one is a pure derivation shared by the client
 * console and the server-side check.
 */
export function confirmationCode(eventSlug: string): string {
  return eventSlug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6).padEnd(6, "X");
}
