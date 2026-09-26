import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  Mail,
  CheckCircle2,
  Info,
} from "lucide-react";
import { getPrimaryEvent, isRegistrationOpen } from "@/server/services/event-service";
import { Activities, Fairness, Journey } from "@/components/public/sections";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EventStatusBadge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import {
  formatEventDate,
  formatRelativeDeadline,
  formatTimeRange,
} from "@/lib/format";

export const metadata: Metadata = {
  title: "About the event",
  description:
    "What Helping Station DEU is, how the day runs, what to bring, and how to take part. Social and environmental awareness and volunteer action at Dong-Eui University.",
};

export const dynamic = "force-dynamic";

const schedule = [
  { time: "09:30", title: "Check-in & team assignment", body: "Collect your entry number, meet your team, pick up the schedule." },
  { time: "10:00", title: "Awareness session", body: "Local social and environmental issues, and what students can realistically do." },
  { time: "11:15", title: "Team poster making", body: "Mixed teams design posters and short-form campaign material." },
  { time: "12:30", title: "Lunch & showcase", body: "Each team presents. Lunch is provided." },
  { time: "13:30", title: "Volunteer action", body: "Clean-up, waste separation and outreach across the campus." },
  { time: "15:00", title: "Closing session & lucky draw", body: "Verified participants are confirmed, then prizes are drawn live." },
  { time: "16:00", title: "Wrap-up", body: "Photo, feedback, and what happens next." },
];

const bringList = [
  "Your student ID",
  "Comfortable clothes you can get dirty",
  "A refillable water bottle",
  "Sun protection (we are outside for part of the day)",
  "Your entry number (on your phone or printed)",
];

const faqs = [
  {
    q: "Do I need experience?",
    a: "No. Plenty of first-timers join every edition, and every activity team has a coordinator who walks new volunteers through it.",
  },
  {
    q: "Is there a fee?",
    a: "No. Registration, activities and lunch are free. Prizes are a token of thanks for taking part.",
  },
  {
    q: "What if I register but cannot come?",
    a: "Please tell the organiser so your place can be released to somebody on the waiting list. You can cancel from your account page.",
  },
  {
    q: "How do I enter the lucky draw?",
    a: "Register, then take part in the main activities. The organiser confirms attendance, and confirmed participants get exactly one draw entry.",
  },
  {
    q: "Do I need to give my phone number?",
    a: "Yes, we need a number to run the event safely. It is not published anywhere, and you can ask the organiser to delete it after the event.",
  },
  {
    q: "What exactly am I consenting to?",
    a: "Three separate things: the participation rules, processing your registration data, and being included in the lucky draw. You can additionally choose whether your masked name is shown on the public winners page, and whether you may be contacted about collecting a prize — both are optional.",
  },
  {
    q: "Is my name shown publicly?",
    a: "No. Public pages only ever show your entry number and, if you opt in, a masked name such as “M**i P***”. Your e-mail, phone and student ID are never published.",
  },
];

export default async function EventPage() {
  const event = await getPrimaryEvent();

  return (
    <>
      {/* header */}
      <section className="bg-canopy relative overflow-hidden py-14 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-50" aria-hidden="true" />
        <div className="container-page relative">
          <Reveal from="up">
            <Badge tone="leaf" dot>
              Social &amp; Environmental Awareness
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-leaf-950 sm:text-5xl">
              {event?.name ?? "Helping Station DEU"}
            </h1>
            {event?.tagline ? (
              <p className="mt-3 max-w-2xl text-lg font-semibold text-leaf-700">{event.tagline}</p>
            ) : null}
            {event ? (
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
                {event.description}
              </p>
            ) : null}
          </Reveal>

          {event ? (
            <Reveal from="up" delay={140} className="mt-8">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <CalendarDays className="h-4 w-4 text-leaf-600" aria-hidden="true" /> Date
                  </dt>
                  <dd className="mt-2 font-bold text-leaf-950">{formatEventDate(event.startAt)}</dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Clock className="h-4 w-4 text-azure-500" aria-hidden="true" /> Time
                  </dt>
                  <dd className="mt-2 font-bold text-leaf-950">
                    {formatTimeRange(event.startAt, event.endAt)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <MapPin className="h-4 w-4 text-gold-500" aria-hidden="true" /> Where
                  </dt>
                  <dd className="mt-2 font-bold text-leaf-950">{event.locationName}</dd>
                  {event.locationAddress ? (
                    <dd className="mt-1 text-sm text-slate-500">{event.locationAddress}</dd>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Info className="h-4 w-4 text-leaf-600" aria-hidden="true" /> Status
                  </dt>
                  <dd className="mt-2">
                    <EventStatusBadge status={event.status} />
                    <p className="mt-1.5 text-sm text-slate-500">
                      Registration closes {formatRelativeDeadline(event.registrationDeadline)}
                    </p>
                  </dd>
                </div>
              </dl>
            </Reveal>
          ) : null}

          <Reveal from="up" delay={220} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">
              {event && isRegistrationOpen(event) ? "🎟️ Register now" : "View the programme"}
            </ButtonLink>
            <ButtonLink href="/rules" variant="secondary" size="lg">
              Draw rules &amp; privacy summary
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      <Journey />
      <Activities />

      {/* schedule */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container-page">
          <Reveal from="up" className="text-center">
            <h2 className="text-3xl font-extrabold text-leaf-950 sm:text-4xl">
              How the day runs
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              Timings are indicative — we keep to them as closely as a student-run programme can.
            </p>
          </Reveal>

          <ol className="mx-auto mt-12 max-w-3xl">
            {schedule.map((slot, index) => (
              <Reveal
                as="li"
                key={slot.time}
                from="left"
                delay={index * 60}
                className="relative flex gap-5 pb-8 pl-2 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-white bg-leaf-600 text-xs font-extrabold text-white shadow-soft">
                    {slot.time}
                  </span>
                  {index < schedule.length - 1 ? (
                    <span className="mt-1 w-0.5 flex-1 bg-leaf-200" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="pt-1.5">
                  <h3 className="font-bold text-leaf-950">{slot.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{slot.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* bring + organiser */}
      <section className="bg-canopy py-16 sm:py-20">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <Reveal from="left" className="rounded-3xl border border-leaf-200 bg-white p-7 shadow-soft">
            <h2 className="text-2xl font-extrabold text-leaf-950">What to bring</h2>
            <ul className="mt-5 space-y-3">
              {bringList.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-2xl bg-leaf-50 p-4 text-sm text-slate-600">
              Lunch, drinking water, gloves and all cleaning equipment are provided by the
              programme. You do not need to bring anything else.
            </p>
          </Reveal>

          <Reveal from="right" delay={100} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
            <h2 className="text-2xl font-extrabold text-leaf-950">Your organiser</h2>
            {event ? (
              <dl className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Team</dt>
                    <dd className="font-semibold text-slate-800">{event.organizerName}</dd>
                  </div>
                </div>
                {event.organizerDepartment ? (
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-azure-500" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Department</dt>
                      <dd className="font-semibold text-slate-800">{event.organizerDepartment}</dd>
                    </div>
                  </div>
                ) : null}
                {event.organizerContact ? (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden="true" />
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact</dt>
                      <dd className="font-semibold text-slate-800">
                        <a href={`mailto:${event.organizerContact}`} className="hover:underline">
                          {event.organizerContact}
                        </a>
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>
            ) : null}
            <p className="mt-6 text-sm leading-relaxed text-slate-600">
              Questions before the day? Ask anything — including accessibility needs, dietary
              requirements, or whether an activity suits you. Nothing is too small to ask.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
              <Link href="/rules" className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold hover:bg-slate-200">
                Participation rules
              </Link>
              <Link href="/privacy" className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold hover:bg-slate-200">
                Privacy policy
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Fairness />

      {/* FAQ */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container-page">
          <Reveal from="up" className="text-center">
            <h2 className="text-3xl font-extrabold text-leaf-950 sm:text-4xl">
              Frequently asked questions
            </h2>
          </Reveal>
          <dl className="mx-auto mt-10 grid max-w-3xl gap-4">
            {faqs.map((faq, index) => (
              <Reveal
                key={faq.q}
                from="up"
                delay={index * 50}
                className="rounded-2xl border border-slate-200 bg-canvas p-5"
              >
                <dt className="font-bold text-leaf-950">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
