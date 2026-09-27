/**
 * Fixed-window rate limiting.
 *
 * Default store is in-process (fine for a single instance, e.g. a university
 * server or one Render service). Set `UPSTASH_REDIS_REST_URL` +
 * `UPSTASH_REDIS_REST_TOKEN` to share counters across serverless instances —
 * see `bumpDistributed`.
 */
import { createHash } from "node:crypto";
import { isDistributedRateLimit, env } from "./env";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetInSeconds: number;
  retryAfterSeconds?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Hash an IP so we never store a raw address. */
export function hashIdentifier(value: string): string {
  const salt = env.authSecret;
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

function sweep(now: number) {
  if (now - lastSweep < 30_000 && buckets.size < 5_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

async function bumpDistributed(key: string, limit: number, windowSeconds: number) {
  const url = `${env.upstashRestUrl.replace(/\/$/, "")}/pipeline`;
  const body = [
    ["INCR", key],
    ["PEXPIRE", key, String(windowSeconds * 1000)],
  ];
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.upstashRestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Upstash request failed: ${response.status}`);
  const payload = (await response.json()) as Array<{ result: number | null }>;
  const count = Number(payload[0]?.result ?? 0);
  return { count, limit, resetInSeconds: windowSeconds };
}

function bumpLocal(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { count: 1, limit, resetInSeconds: windowSeconds };
  }
  existing.count += 1;
  return {
    count: existing.count,
    limit,
    resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Consume one unit from a named bucket.
 *
 * @param key    logical bucket name, e.g. "register:ip"
 * @param id     caller identifier (hashed IP, e-mail, entry number…)
 * @param limit  allowed hits per window
 * @param windowSeconds window length
 */
export async function rateLimit(
  key: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const bucketKey = `hs:${key}:${id}`;

  try {
    if (isDistributedRateLimit()) {
      const { count, limit: max, resetInSeconds } = await bumpDistributed(
        bucketKey,
        limit,
        windowSeconds,
      );
      const remaining = Math.max(0, max - count);
      return {
        ok: count <= max,
        limit: max,
        remaining,
        resetInSeconds,
        ...(count > max ? { retryAfterSeconds: resetInSeconds } : {}),
      };
    }
  } catch {
    // Never let a rate-limit backend outage take the site down: fail open to
    // the local limiter.
  }

  const { count, limit: max, resetInSeconds } = bumpLocal(bucketKey, limit, windowSeconds);
  const remaining = Math.max(0, max - count);
  return {
    ok: count <= max,
    limit: max,
    remaining,
    resetInSeconds,
    ...(count > max ? { retryAfterSeconds: resetInSeconds } : {}),
  };
}

/** Pre-configured limits for the sensitive endpoints. */
export const LIMITS = {
  register: { key: "register", limit: 5, windowSeconds: 10 * 60 },
  registerEmail: { key: "register-email", limit: 3, windowSeconds: 60 * 60 },
  login: { key: "login", limit: 8, windowSeconds: 10 * 60 },
  adminLogin: { key: "admin-login", limit: 5, windowSeconds: 15 * 60 },
  draw: { key: "draw", limit: 10, windowSeconds: 60 * 60 },
  export: { key: "export", limit: 30, windowSeconds: 60 * 60 },
  /**
   * First-run setup at `/setup`. Tight on purpose: the deployment's
   * `ADMIN_SETUP_TOKEN` is the only thing standing between an anonymous
   * visitor and an admin account, so a handful of wrong guesses per hour is
   * all this needs to allow. It closes entirely once an admin exists.
   */
  adminSetup: { key: "admin-setup", limit: 5, windowSeconds: 60 * 60 },
} as const;
