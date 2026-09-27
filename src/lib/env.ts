/**
 * Environment access.
 *
 * Rules:
 *  - Secrets are read here and nowhere else, and are never returned to a client
 *    component.
 *  - Missing optional integrations degrade gracefully (no Turnstile, no
 *    Upstash, in-memory rate limit).
 *  - A missing AUTH_SECRET is fatal in production but only warns in dev so
 *    `next build` works on a fresh clone.
 */

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const warnings: string[] = [];

let authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  if (isProduction) {
    throw new Error(
      "AUTH_SECRET is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  warnings.push("AUTH_SECRET is not set — using an insecure development fallback.");
  authSecret = "dev-insecure-secret-do-not-use-in-production";
}

if (isProduction && appUrl.includes("localhost")) {
  warnings.push("NEXT_PUBLIC_APP_URL still points at localhost in production.");
}

export const env = {
  nodeEnv,
  isProduction,
  isDevelopment: nodeEnv === "development",
  /** Explicit production flag for non-Next build hosts. */
  appIsProduction: bool(process.env.APP_IS_PRODUCTION, isProduction),

  appUrl,
  appName: "Helping Station DEU",
  contactEmail: process.env.CONTACT_EMAIL ?? "helpingstation@deu.ac.kr",
  organizerName:
    process.env.ORGANIZER_NAME ?? "Helping Station DEU — Dong-Eui University",
  dataRetentionDays: int(process.env.DATA_RETENTION_DAYS, 180),

  authSecret,
  authTrustHost: bool(process.env.AUTH_TRUST_HOST, true),
  authMaxAge: int(process.env.AUTH_MAX_AGE, 60 * 60 * 12),

  /**
   * One-shot token that unlocks `/setup`, the page that creates the very first
   * organiser account.
   *
   * Empty by default, and the page refuses to render when it is empty, so a
   * deployment that never sets it has no way to gain an admin through the web
   * at all. The setup route also stops existing once an admin exists, so this
   * is a bootstrap door, not a permanent one. Set it, create the account, then
   * delete the variable and redeploy.
   */
  adminSetupToken: (process.env.ADMIN_SETUP_TOKEN ?? "").trim(),

  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5433/helpingstation",
  /**
   * Maximum pooled connections. Keep this at 1 when using the bundled
   * single-connection PGlite dev server (`npm run db:dev`); managed Postgres
   * deployments should size it for their plan.
   */
  dbPoolMax: Math.max(1, int(process.env.DB_POOL_MAX, 10)),

  // Demo mode is force-disabled in production so demo credentials can never
  // reach a live event, no matter what the environment file says.
  demoMode: !isProduction && bool(process.env.DEMO_MODE, true),

  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? "",

  upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",

  notificationsEnabled: bool(process.env.NOTIFICATIONS_ENABLED, false),
  notificationFromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? "no-reply@helpingstation.deu",

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /**
   * Optional. When set, Google sign-in is restricted to addresses ending in
   * this suffix. When empty, any Google account may sign in and self-register.
   * Normalised to a leading "@" so both `deu.ac.kr` and `@deu.ac.kr` work.
   */
  googleAllowedDomain: (() => {
    const raw = (process.env.GOOGLE_ALLOWED_DOMAIN ?? "").trim().toLowerCase();
    if (!raw) return "";
    return raw.startsWith("@") ? raw : `@${raw}`;
  })(),

  warnings,
} as const;

export type Env = typeof env;

export const isTurnstileEnabled = () =>
  env.turnstileSiteKey.length > 0 && env.turnstileSecretKey.length > 0;
export const isDistributedRateLimit = () =>
  env.upstashRestUrl.length > 0 && env.upstashRestToken.length > 0;
export const isGoogleEnabled = () =>
  env.googleClientId.length > 0 && env.googleClientSecret.length > 0;
/** True when a domain restriction is configured and the address fails it. */
export const isEmailDomainAllowed = (email: string) =>
  !env.googleAllowedDomain || email.toLowerCase().endsWith(env.googleAllowedDomain);
