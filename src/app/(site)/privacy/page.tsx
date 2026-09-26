import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  EyeOff,
  FileText,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data Helping Station DEU collects, why, who can see it, how long it is kept, and how to have it deleted.",
};

export const dynamic = "force-static";

/** Bump when the policy text below changes. */
const LAST_UPDATED = "1 March 2026";

const collected = [
  {
    field: "Full name",
    why: "To check you in on the day and to know who is on site.",
    lawful: "Performance of a contract (participation)",
  },
  {
    field: "University e-mail address",
    why: "To confirm you are a student, to send your entry number, and to let you sign in to check your status.",
    lawful: "Legitimate interest (running the event)",
  },
  {
    field: "Student ID",
    why: "To verify student status and, if you win, to hand over a prize to the right person.",
    lawful: "Legal obligation (event compliance)",
  },
  {
    field: "Department",
    why: "To place you in a balanced activity team. Never published.",
    lawful: "Legitimate interest (running the event)",
  },
  {
    field: "Phone number",
    why: "For on-the-day safety and emergencies.",
    lawful: "Legitimate interest (health and safety)",
  },
  {
    field: "Emergency contact name and number",
    why: "To be able to reach someone quickly if something happens during the event.",
    lawful: "Legitimate interest (health and safety)",
  },
  {
    field: "Consent flags",
    why: "To record what you agreed to, and to prove we recorded it.",
    lawful: "Consent",
  },
];

const notCollected = [
  "Photographs or video of you",
  "Your location or movements during the event",
  "Payment details — participation is free",
  "Marketing profiles, advertising IDs or third-party trackers",
  "Your device fingerprint beyond a salted hash of your IP address used for rate limiting",
];

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
        <div className="container-page relative">
          <Reveal from="up" className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-azure-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-azure-600">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Plain language
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold text-leaf-950 sm:text-5xl">
              Privacy policy
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Helping Station DEU is run by students for students. We collect the minimum needed to
              run a safe event, we do not sell or share anything with sponsors, and you can ask us to
              delete your data at any time.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Last updated {LAST_UPDATED} · Contact{" "}
              <a
                href={`mailto:${env.contactEmail}`}
                className="font-semibold text-leaf-700 underline underline-offset-2"
              >
                {env.contactEmail}
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      <div className="bg-white py-14 sm:py-16">
        <div className="container-page max-w-4xl space-y-6">
          {/* who can see what */}
          <Reveal from="up" className="rounded-3xl border-2 border-leaf-200 bg-leaf-50/60 p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
              <EyeOff className="h-6 w-6 text-leaf-600" aria-hidden="true" />
              Who can see what
            </h2>
            <ul className="mt-5 space-y-3">
              {[
                { who: "You", what: "Your own registration, participation status and any prizes you have won. Nothing more." },
                { who: "The event organiser", what: "The details they need to run a safe event. Access to individual full records is logged." },
                { who: "Any visitor", what: "Your entry number, and a masked name only if you opted in. Never your e-mail, phone, student ID or full name." },
                { who: "Nobody else", what: "No sponsors, no advertisers, no analytics or advertising third parties, no data brokers." },
              ].map((row) => (
                <li key={row.who} className="flex flex-col gap-1 rounded-2xl bg-white p-4 sm:flex-row sm:gap-4">
                  <span className="w-40 shrink-0 text-sm font-extrabold text-leaf-800">{row.who}</span>
                  <span className="text-sm leading-relaxed text-slate-700">{row.what}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* collected */}
          <Reveal from="up" className="rounded-3xl border border-slate-200 bg-canvas p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
              <Database className="h-6 w-6 text-azure-500" aria-hidden="true" />
              What we collect, and why
            </h2>
            <p className="mt-3 text-slate-600">
              Every field below is asked for on the registration form. If a field is optional it says
              so on the form, and leaving it blank never affects your participation.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th scope="col" className="py-2.5 pr-4 font-extrabold text-slate-700">Field</th>
                    <th scope="col" className="py-2.5 pr-4 font-extrabold text-slate-700">Why we need it</th>
                    <th scope="col" className="py-2.5 font-extrabold text-slate-700">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {collected.map((item) => (
                    <tr key={item.field} className="border-b border-slate-200 last:border-0">
                      <th scope="row" className="py-3 pr-4 align-top font-bold text-leaf-900">
                        {item.field}
                      </th>
                      <td className="py-3 pr-4 align-top text-slate-700">{item.why}</td>
                      <td className="py-3 align-top text-xs text-slate-500">{item.lawful}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* not collected */}
          <Reveal from="up" className="rounded-3xl border border-slate-200 bg-canvas p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
              <EyeOff className="h-6 w-6 text-slate-400" aria-hidden="true" />
              What we never collect
            </h2>
            <ul className="mt-5 space-y-2.5">
              {notCollected.map((item) => (
                <li key={item} className="flex gap-3 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* retention */}
          <Reveal from="up" className="rounded-3xl border border-slate-200 bg-canvas p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
              <Trash2 className="h-6 w-6 text-gold-500" aria-hidden="true" />
              How long we keep it
            </h2>
            <ul className="mt-5 space-y-3 text-slate-700">
              {[
                `Registration records are kept for up to ${env.dataRetentionDays} days after the event, then anonymised. Anonymised records keep only a statistical entry number and status — they cannot be traced back to you.`,
                "Audit logs of organiser actions are kept for 12 months. They contain entry numbers and action names, never names, e-mails or phone numbers.",
                "Login attempt records are kept for 30 days and store a salted hash of your IP address, never the address itself.",
                "Prize and claim records are kept for 3 years where tax or accounting rules require it.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" aria-hidden="true" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-2xl border border-gold-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong className="font-extrabold">Want it gone sooner?</strong> Email{" "}
              <a href={`mailto:${env.contactEmail}`} className="font-semibold underline underline-offset-2">
                {env.contactEmail}
              </a>{" "}
              with the subject “Data deletion request”. We will confirm within 7 days. Deleting your
              data before the draw removes your entry, so do it before the event if you are not
              coming.
            </p>
          </Reveal>

          {/* technical */}
          <Reveal from="up" className="rounded-3xl border border-slate-200 bg-canvas p-6 sm:p-8">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
              <Lock className="h-6 w-6 text-leaf-600" aria-hidden="true" />
              How it is protected
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { title: "Passwords are hashed", body: "Passwords are stored as bcrypt hashes. Nobody — including the organiser — can read them." },
                { title: "Sessions are signed", body: "Sign-in uses signed, HTTP-only, secure cookies. Session contents are not readable by scripts." },
                { title: "Transport security", body: "The site is served over HTTPS only, with a strict content security policy and security headers." },
                { title: "Rate limiting", body: "Sign-in and registration are rate limited to stop bulk scraping. Only a salted hash of an IP address is kept." },
                { title: "Separated draw data", body: "The draw runs against a frozen, hashed snapshot rather than the live registration table, so no one can add themselves in." },
                { title: "Access is logged", body: "Opening a participant's full record in the admin area is written to the audit log." },
              ].map((item) => (
                <li key={item.title} className="rounded-2xl bg-white p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-leaf-900">
                    <UserCheck className="h-4 w-4 text-leaf-600" aria-hidden="true" />
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* contact */}
          <Reveal from="up" className="rounded-3xl border-2 border-leaf-200 bg-white p-6 text-center shadow-soft sm:p-8">
            <h2 className="flex items-center justify-center gap-2 font-display text-2xl font-extrabold text-leaf-950">
              <FileText className="h-6 w-6 text-leaf-600" aria-hidden="true" />
              Your rights
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              You can ask what we hold about you, ask for a copy, ask us to correct it, or ask us to
              delete it. We will not ask why, and we do not make it difficult.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={`mailto:${env.contactEmail}?subject=Data%20request`}
                className="inline-flex h-13 items-center gap-2 rounded-full bg-leaf-700 px-7 font-semibold text-white shadow-soft transition hover:bg-leaf-800"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email {env.contactEmail}
              </a>
              <ButtonLink href="/rules" variant="secondary">
                Read the draw rules
              </ButtonLink>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Read the{" "}
              <Link href="/rules" className="font-semibold text-leaf-700 underline underline-offset-2">
                participation rules
              </Link>{" "}
              to see what the draw does and does not do with your data.
            </p>
          </Reveal>
        </div>
      </div>
    </>
  );
}
