import type { Metadata } from "next";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Lock,
  ScrollText,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { LeafDivider } from "@/components/site/illustrations";

export const metadata: Metadata = {
  title: "Participation & draw rules",
  description:
    "The exact rules of the Helping Station DEU lucky draw: who is eligible, how the pool is locked, how randomness is generated, and how mistakes are corrected.",
};

export const dynamic = "force-static";

/**
 * The rules page.
 *
 * Written in plain language, but the numbers matter: an organiser can read this
 * page and be held to it. It is rendered from a static data structure so the
 * same list can be reused in the registration form.
 */
const sections = [
  {
    id: "participation",
    icon: Users,
    title: "Who can enter",
    body: [
      "You must be a registered student of Dong-Eui University, and you must register for the event before the deadline closes.",
      "You must actually take part. The organiser marks attendance on the day, and only participants confirmed as having participated become eligible.",
      "You must have ticked the lucky draw consent box on the registration form. This consent is separate from everything else and is required to win.",
      "One entry per student, per event. The system blocks a second registration from the same person automatically — you do not need to email us about it.",
    ],
  },
  {
    id: "locking",
    icon: Lock,
    title: "The pool is locked before anybody is selected",
    body: [
      "Once registration closes, the organiser marks attendance and reviews eligibility. That review is manual and is recorded in the audit log, entry by entry.",
      "When the organiser is satisfied, they lock the pool. Locking writes a frozen snapshot of every eligible entry number into the database together with a SHA-256 fingerprint of that list.",
      "After locking, the list cannot be edited by anybody — including the organiser. There is no \"add one more\" and no \"oops, that was the wrong person\". If somebody was missed, they are handled through the correction process below.",
      "A completed draw is permanent. Re-running it to get a different result is impossible by design.",
    ],
  },
  {
    id: "randomness",
    icon: Fingerprint,
    title: "How a winner is chosen",
    body: [
      "Selection runs on the server. Your browser, and the animation you watch, have no say in it — they can only display a result that has already been decided and stored.",
      "The randomness comes from the operating system's cryptographically secure random number generator, not from a shuffled array, not from a seeded pseudo-random generator, and not from anything the organiser typed.",
      "Before selecting anybody, the server publishes a commitment: a hash of the random seed it is about to use. Because a hash cannot be run backwards, the organiser cannot change the seed after seeing the outcome without breaking the commitment.",
      "The seed is revealed when the draw completes. The published algorithm — sort, Fisher-Yates shuffle with the CSPRNG, then take the first entries in prize order — reproduces the same winners from the same seed and the same frozen list.",
      "One participant can hold at most one prize per event, unless the event page explicitly says otherwise. A winner is removed from the pool before the next prize is drawn.",
      "If there are fewer eligible entries than prize slots, the remaining slots simply go unclaimed. We do not re-draw, re-roll, or pick a \"second winner\" outside these rules.",
    ],
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "What the public can and cannot see",
    body: [
      "Public pages show your entry number, and — only if you opted in — a masked name such as “M**i P***”.",
      "Your e-mail address, phone number and student ID are never published, never included in a public API response, and never shown on the winners page.",
      "The organiser sees the details they need to run a safe event. Those details are not sold, not shared with sponsors, and not used for marketing.",
      "Full details in the <Link href=\"/privacy\" className=\"font-semibold text-leaf-700 underline underline-offset-2\">privacy policy</Link>.",
    ],
  },
  {
    id: "corrections",
    icon: ScrollText,
    title: "If something goes wrong",
    body: [
      "A completed draw is never edited. Mistakes are fixed by appending a correction record that says what happened and why, and the original result stays visible in the audit trail.",
      "If a winner turns out to be ineligible — for example they did not take part after all — their prize is revoked, the reason is recorded, and the prize is reissued to the next eligible entry from the same frozen pool, following the same published algorithm.",
      "Every sensitive action in the organiser area is written to an append-only audit log: who did it, when, to which record, and what changed.",
    ],
  },
  {
    id: "conduct",
    icon: AlertTriangle,
    title: "Fair play",
    body: [
      "One registration per person. Multiple accounts, bots and automated submissions are blocked.",
      "Winning does not depend on skill, and the draw is not something you can be \"better at\". That is the point of using a cryptographic random generator.",
      "Prizes are a thank-you for taking part, not a payment. We reserve the right to decline a prize claim that we believe was obtained dishonestly, and that decision is recorded.",
      "If you disagree with how the draw was run, ask the organiser. Every correction is logged and the original is never quietly deleted.",
    ],
  },
];

const notAllowed = [
  "Joining the draw more than once, under more than one name or account",
  "Asking for a specific prize, or a specific outcome",
  "Pressuring a participant to withdraw so a slot opens up for somebody else",
  "Sharing a winner's name, entry number or photo without their consent",
];

const allowed = [
  "Registering, taking part, and entering the draw",
  "Asking how the randomness was produced, and seeing the published fingerprints",
  "Withdrawing your own registration before the pool is locked",
  "Reporting a mistake in the result — corrections are recorded, not hidden",
];

export default function RulesPage() {
  return (
    <>
      <section className="bg-canopy relative overflow-hidden py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-40" aria-hidden="true" />
        <div className="container-page relative">
          <Reveal from="up" className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800">
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Published rules
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold text-leaf-950 sm:text-5xl">
              Participation &amp; draw rules
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              These rules are the contract. They are written down before the draw, they are enforced
              by the software rather than by good intentions, and the same rules apply to the
              organiser as to anybody else.
            </p>
            <LeafDivider className="mx-auto mt-6 h-6 w-56" />
          </Reveal>
        </div>
      </section>

      <div className="bg-white py-14 sm:py-16">
        <div className="container-page max-w-4xl">
          <nav aria-label="On this page" className="mb-10">
            <ul className="flex flex-wrap justify-center gap-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-leaf-400 hover:bg-leaf-50 hover:text-leaf-800"
                  >
                    <section.icon className="h-4 w-4" aria-hidden="true" />
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <Reveal
                  as="section"
                  key={section.id}
                  id={section.id}
                  from="up"
                  delay={index * 40}
                  className="scroll-mt-24 rounded-3xl border border-slate-200 bg-canvas p-6 sm:p-8"
                >
                  <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-leaf-950">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {section.title}
                  </h2>
                  <ol className="mt-5 space-y-3">
                    {section.body.map((paragraph, paragraphIndex) => (
                      <li key={paragraphIndex} className="flex gap-3 text-slate-700">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500"
                          aria-hidden="true"
                        />
                        <span className="leading-relaxed">{paragraph}</span>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              );
            })}
          </div>

          {/* quick reference */}
          <Reveal from="up" className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-leaf-200 bg-leaf-50/60 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-leaf-950">
                <CheckCircle2 className="h-5 w-5 text-leaf-600" aria-hidden="true" />
                You are welcome to
              </h2>
              <ul className="mt-4 space-y-2.5">
                {allowed.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border-2 border-red-100 bg-red-50/70 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-leaf-950">
                <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                Please do not
              </h2>
              <ul className="mt-4 space-y-2.5">
                {notAllowed.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal from="up" className="mt-10 rounded-3xl border border-azure-200 bg-azure-50 p-7 text-center">
            <h2 className="font-display text-xl font-extrabold text-leaf-950">Questions about these rules?</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-600">
              Ask before you register rather than after. A rule nobody explained is a rule nobody
              can rely on.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/register" size="lg">
                Register for the event
              </ButtonLink>
              <ButtonLink href="/privacy" variant="secondary" size="lg">
                Privacy policy
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
