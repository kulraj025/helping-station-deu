/**
 * Site-wide section switches: the database access.
 *
 * The pure definitions live in `src/lib/site-settings.ts`; this file is the part
 * that needs a database, a server runtime, and therefore `server-only`.
 *
 * **Reading never throws.** If the settings table is missing — an old database
 * that has not had the migration run yet — the site must stay open rather than
 * take itself offline. A missing table means "no opinion", and the safe reading
 * of no opinion is the default: everything open. Every failure path here
 * therefore resolves to `OPEN_SETTINGS` and logs loudly, rather than
 * propagating into a 500 on the home page.
 */
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  OPEN_SETTINGS,
  type SiteSectionKey,
  type SiteSettingsInput,
  type SiteSettingsShape,
} from "@/lib/site-settings";

/** The columns selected everywhere, so no caller can accidentally ask for more. */
const SELECT = {
  siteOpen: true,
  registerOpen: true,
  winnersOpen: true,
  drawOpen: true,
  rulesOpen: true,
  showCount: true,
  closedNote: true,
  updatedBy: true,
  updatedAt: true,
} as const;

/**
 * Read the switches.
 *
 * Wrapped in `cache` so a page that checks three sections still runs one query.
 * The row is created on first read rather than seeded, which means a brand new
 * database is open without a migration-time seed step.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettingsShape> => {
  try {
    return await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
      select: SELECT,
    });
  } catch (error) {
    console.error(
      "[site-settings] could not read settings, treating the site as open:",
      error,
    );
    return OPEN_SETTINGS;
  }
});

/**
 * Whether a section is currently open.
 *
 * `siteOpen` gates everything: closing the site closes each section with it, so
 * one switch can take the whole thing down for maintenance.
 */
export async function isSectionOpen(section: SiteSectionKey): Promise<boolean> {
  const settings = await getSiteSettings();
  if (!settings.siteOpen) return false;
  return settings[section];
}

/** Persist the switches and record who changed them. */
export async function saveSiteSettings(
  input: SiteSettingsInput,
  adminId: string,
): Promise<SiteSettingsShape> {
  return prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...input, updatedBy: adminId },
    update: { ...input, updatedBy: adminId },
    select: SELECT,
  });
}
