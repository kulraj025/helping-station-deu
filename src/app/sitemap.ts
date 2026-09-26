import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listEvents } from "@/server/services/event-service";

export const dynamic = "force-dynamic";

/**
 * sitemap.xml.
 *
 * Only the stable public pages plus events that are actually published.
 * Anything participant-specific — an account, a confirmation, a draw screen —
 * is deliberately absent, because none of it is a page anybody should find by
 * searching.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${env.appUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${env.appUrl}/event`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${env.appUrl}/register`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${env.appUrl}/winners`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${env.appUrl}/rules`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${env.appUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.5 },
  ];

  let events: MetadataRoute.Sitemap = [];
  try {
    const published = await listEvents();
    events = published
      .filter((event) => event.status === "PUBLISHED" || event.status === "COMPLETED")
      .map((event) => ({
        url: `${env.appUrl}/event/${event.slug}`,
        lastModified: new Date(event.updatedAt ?? event.startAt),
        changeFrequency: "daily" as const,
        priority: event.status === "PUBLISHED" ? 0.8 : 0.6,
      }));
  } catch {
    // A database hiccup should produce a sitemap without event pages rather than
    // a 500 for a file that crawlers treat as optional.
    events = [];
  }

  return [...staticEntries, ...events];
}
