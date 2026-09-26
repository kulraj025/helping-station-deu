import "server-only";
import { headers } from "next/headers";
import { hashIdentifier } from "./rate-limit";

/**
 * Request helpers.
 *
 * Client IP is only ever used hashed (rate limiting + audit logs), so no raw
 * address is persisted.
 */

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-vercel-forwarded-for") ??
    "unknown"
  );
}

export async function getClientIpHash(): Promise<string> {
  return hashIdentifier(await getClientIp());
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return (h.get("user-agent") ?? "").slice(0, 300);
}

/**
 * Reject state-changing requests whose Origin does not match the Host.
 * A belt-and-braces CSRF check for route handlers (server actions already get
 * Next.js' own origin protection).
 */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) {
    // Same-origin form posts from some browsers omit Origin. Fall back to
    // Fetch Metadata when available, and allow it when neither header exists.
    const secFetchSite = h.get("sec-fetch-site");
    if (!secFetchSite) return true;
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
