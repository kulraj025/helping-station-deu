import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Database,
  FlaskConical,
  KeyRound,
  Lock,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isDistributedRateLimit, isTurnstileEnabled } from "@/lib/env";
import { PageBody, PageHeader, Panel } from "@/components/admin/page-parts";
import { FormAlert } from "@/components/ui/input";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** A configuration fact plus whether it is in a good state. */
function Check({
  ok,
  label,
  detail,
  warn,
}: {
  ok: boolean;
  label: string;
  detail: string;
  warn?: boolean;
}) {
  const tone = ok ? "leaf" : warn ? "gold" : "red";
  const Icon = ok ? CheckCircle2 : TriangleAlert;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={
          tone === "leaf"
            ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf-100 text-leaf-700"
            : tone === "gold"
              ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
              : "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"
        }
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{detail}</span>
      </span>
    </li>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{term}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-700">{children}</dd>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const admin = await requireAdmin("/admin/settings");

  const [admins, events, registrations, drawsCompleted, auditEntries] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.event.count(),
    prisma.registration.count(),
    prisma.draw.count({ where: { status: "COMPLETED" } }),
    prisma.auditLog.count(),
  ]);

  const turnstile = isTurnstileEnabled();
  const distributed = isDistributedRateLimit();
  const secretIsDevFallback = env.authSecret === "dev-insecure-secret-do-not-use-in-production";
  const localhostUrl = env.appUrl.includes("localhost");

  return (
    <PageBody>
      <PageHeader
        title="Settings"
        description="Configuration is read from environment variables, not stored in the database, so a deployment cannot drift from its own environment file."
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-slate-600">
            <ServerCog className="h-3 w-3" aria-hidden="true" />
            {env.nodeEnv}
          </span>
        }
      />

      {/* readiness */}
      <Panel
        tone={env.warnings.length > 0 || secretIsDevFallback ? "warning" : "success"}
        title="Deployment readiness"
        description="Checked against the rules the app actually enforces, not against a wish list."
      >
        <ul className="divide-y divide-slate-100">
          <Check
            ok={!secretIsDevFallback}
            warn
            label="AUTH_SECRET is set from the environment"
            detail={
              secretIsDevFallback
                ? "The insecure development fallback is in use. Set AUTH_SECRET before exposing this deployment to anybody."
                : "Session signing uses a real secret from the environment file, never a default."
            }
          />
          <Check
            ok={!(env.isProduction && localhostUrl)}
            label="Public URL is absolute"
            detail={
              localhostUrl
                ? `NEXT_PUBLIC_APP_URL is ${env.appUrl}. Participants' links and the QR code will point at localhost, which will not work for them.`
                : `Registration links and QR codes resolve to ${env.appUrl}.`
            }
          />
          <Check
            ok={!env.demoMode || !env.isProduction}
            label="Demo mode cannot run in production"
            detail={
              env.demoMode
                ? "Demo mode is on, so fictional participants are banner-flagged across the site. It is force-disabled whenever NODE_ENV=production."
                : "Demo mode is off. Every record here is treated as real."
            }
          />
          <Check
            ok={distributed}
            warn
            label="Rate limiting is shared across instances"
            detail={
              distributed
                ? "Upstash Redis is configured, so the registration rate limit is enforced across every instance."
                : "Rate limiting is in-process only. That is fine for one server; behind a load balancer each instance gets its own budget. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a real deployment."
            }
          />
          <Check
            ok={turnstile}
            warn
            label="Bot protection is active"
            detail={
              turnstile
                ? "Cloudflare Turnstile is configured, so bot submissions are checked before any database work happens."
                : "No captcha is configured. The honeypot field and rate limit still apply, which is the correct minimum but not a strong defence."
            }
          />
          <Check
            ok={env.isProduction || env.dbPoolMax > 1}
            warn
            label="Database pool matches the server"
            detail={
              env.dbPoolMax === 1
                ? "DB_POOL_MAX is 1, which is what the bundled single-connection PGlite dev server needs. Raise it for a real PostgreSQL server."
                : `DB_POOL_MAX is ${env.dbPoolMax} pooled connections.`
            }
          />
        </ul>

        {env.warnings.length > 0 ? (
          <div className="mt-4 space-y-2">
            {env.warnings.map((warning) => (
              <FormAlert key={warning} tone="warning">
                {warning}
              </FormAlert>
            ))}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Environment">
          <dl>
            <Row term="Application name">{env.appName}</Row>
            <Row term="Public URL">{env.appUrl}</Row>
            <Row term="Contact e-mail">{env.contactEmail}</Row>
            <Row term="Organiser">{env.organizerName}</Row>
            <Row term="Node environment">
              {env.nodeEnv} {env.appIsProduction ? "(explicit production flag set)" : null}
            </Row>
            <Row term="Session lifetime">
              {Math.round(env.authMaxAge / 3600)} hours
            </Row>
            <Row term="Data retention guidance">
              {env.dataRetentionDays} days
            </Row>
            <Row term="Notifications">
              {env.notificationsEnabled
                ? `Enabled, from ${env.notificationFromEmail}`
                : "Disabled — notifications are recorded as rows but not sent."}
            </Row>
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Secrets are read on the server only. No secret, key or connection string is ever
              included in a payload sent to the browser.
            </span>
          </p>
        </Panel>

        <Panel title="Database">
          <dl>
            <Row term="Provider">PostgreSQL (Prisma)</Row>
            <Row term="Pool size">{env.dbPoolMax}</Row>
            <Row term="Events">{events}</Row>
            <Row term="Registrations">{registrations}</Row>
            <Row term="Completed draws">{drawsCompleted}</Row>
            <Row term="Audit entries">{auditEntries}</Row>
            <Row term="Organiser accounts">{admins}</Row>
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Connection strings are masked here on purpose. The full value stays in the
              environment file and is never rendered, exported or logged.
            </span>
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your account">
          <dl>
            <Row term="Signed in as">{admin.email}</Row>
            <Row term="Display name">{admin.name}</Row>
            <Row term="Role">{admin.role}</Row>
            <Row term="Organiser accounts">
              {admins} {admins === 1 ? "account" : "accounts"} can reach this area
            </Row>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            To change a password, sign out and use the reset link on the sign-in page. There is no
            password field here on purpose: an organiser area that stores credentials it does not
            need to store is a worse design, not a better one.
          </p>
        </Panel>

        <Panel title="How this system protects participants">
          <ul className="space-y-3 text-sm leading-relaxed text-slate-700">
            {[
              [ShieldCheck, "No contact details on any public page"],
              [Lock, "Draw pool frozen and hashed before any winner is chosen"],
              [Database, "Every sensitive action written to an append-only log"],
            ].map(([Icon, text]) => {
              const Component = Icon as typeof ShieldCheck;
              return (
                <li key={String(text)} className="flex items-start gap-2.5">
                  <Component className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
                  <span>{String(text)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            These are described in full on the{" "}
            <Link href="/rules" className="font-semibold text-leaf-700 underline underline-offset-2">
              rules page
            </Link>{" "}
            and the{" "}
            <Link
              href="/privacy"
              className="font-semibold text-leaf-700 underline underline-offset-2"
            >
              privacy page
            </Link>
            , which is the wording participants actually see.
          </p>
        </Panel>
      </div>

      {env.demoMode ? (
        <Panel tone="warning" title="Demo mode is on">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-2 text-sm leading-relaxed text-amber-900">
              <p>
                Every participant, entry number and winner is fictional while this is on, and a
                banner says so on every page. Demo events carry an{" "}
                <code className="rounded bg-amber-100 px-1 font-mono text-xs">isDemo</code> flag that
                keeps them separate from real data at the database level, and only demo events can be
                reset for a rehearsal.
              </p>
              <p>
                Set <code className="rounded bg-amber-100 px-1 font-mono text-xs">DEMO_MODE=false</code>{" "}
                — or deploy with <code className="rounded bg-amber-100 px-1 font-mono text-xs">NODE_ENV=production</code>,
                which forces it off regardless — before using this for a real event.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}
    </PageBody>
  );
}
