import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * robots.txt.
 *
 * The organiser area and the projector display are excluded: the first holds
 * personal data, the second is a screen for the room. A crawler following a
 * registration link should land on the public form, which is indexable on
 * purpose so posters and QR codes can be shared.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/event", "/register", "/rules", "/privacy", "/winners", "/success"],
        disallow: [
          "/admin",
          "/api/",
          "/account",
          "/login",
          "/draw/display",
          "/success?",
          "/*?*entry=",
          "/*?*event=",
        ],
      },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
    host: env.appUrl,
  };
}
