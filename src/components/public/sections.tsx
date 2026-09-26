import Link from "next/link";
import {
  BookOpen,
  Brush,
  Recycle,
  Sparkles,
  Sprout,
  Users,
  Trophy,
  HandHeart,
  Megaphone,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CountUp, Reveal } from "@/components/ui/reveal";
import { ImpactArt, LeafDivider } from "@/components/site/illustrations";

/** Quick facts strip under the hero. */
export function StatsStrip({
  participants,
  activities,
  prizes,
}: {
  participants: number | null;
  activities: number;
  prizes: number;
}) {
  const items = [
    { value: participants, suffix: "", label: "Students registered", fallback: "—" },
    { value: activities, suffix: "", label: "Activities on the day", fallback: "6" },
    { value: prizes, suffix: "", label: "Prizes to be won", fallback: "—" },
    { value: null, suffix: "", label: "Cost to take part", literal: "Free", fallback: "Free" },
  ];

  return (
    <section className="no-print border-y border-leaf-200/60 bg-white/70 backdrop-blur">
      <div className="container-page grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
        {items.map((item, index) => (
          <Reveal key={item.label} from="up" delay={index * 70} className="text-center">
            <p className="font-display text-3xl font-extrabold text-leaf-800 sm:text-4xl">
              {item.literal ? (
                item.literal
              ) : item.value === null ? (
                item.fallback
              ) : (
                <CountUp to={item.value} suffix={item.suffix} />
              )}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm">
              {item.label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** The five-stage programme journey. */
export function Journey() {
  const steps = [
    {
      emoji: "📚",
      title: "Awareness session",
      body: "Short, engaging talks and videos about local social and environmental issues — plus what students can realistically do about them.",
      time: "60 min",
    },
    {
      emoji: "🎨",
      title: "Team poster making",
      body: "Small mixed teams design posters, slogans and social-media cards that turn the message into something shareable.",
      time: "75 min",
    },
    {
      emoji: "🗣️",
      title: "Group showcase",
      body: "Each team presents its work. Every participant gets a chance to stand up and speak — first-timers especially welcome.",
      time: "45 min",
    },
    {
      emoji: "🧹",
      title: "Volunteer action",
      body: "Real work, not role-play: campus clean-up, waste separation stations, recycling drives and outreach in the community.",
      time: "90 min",
    },
    {
      emoji: "🎁",
      title: "Lucky draw & awards",
      body: "Every verified participant gets one entry. Prizes are drawn live on the projector and can be verified afterwards.",
      time: "30 min",
    },
  ];

  return (
    <section id="journey" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="container-page">
        <Reveal from="up" className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Your day
          </span>
          <h2 className="mt-5 text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            The programme journey
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
            Five stages that take a group of students from listening, to creating, to actually
            changing something on campus.
          </p>
          <LeafDivider className="mx-auto mt-6 h-6 w-56" />
        </Reveal>

        <ol className="relative mt-12 grid gap-6 lg:grid-cols-5">
          {/* connecting line on desktop */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-6 hidden h-0.5 bg-gradient-to-r from-leaf-200 via-leaf-400 to-leaf-200 lg:block"
            aria-hidden="true"
          />
          {steps.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              from="up"
              delay={index * 90}
              className="relative rounded-2xl border border-slate-200 bg-canvas p-6 text-center shadow-soft lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none"
            >
              <span
                className="mx-auto grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-leaf-600 text-xl shadow-soft"
                aria-hidden="true"
              >
                {step.emoji}
              </span>
              <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-leaf-600">
                Stage {index + 1} · {step.time}
              </p>
              <h3 className="mt-1.5 text-lg font-bold text-leaf-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const activities = [
  {
    icon: Recycle,
    title: "Waste separation station",
    body: "Sort, label and weigh campus waste, then record what could actually be recycled.",
    emoji: "♻️",
  },
  {
    icon: Brush,
    title: "Poster & design team",
    body: "Turn awareness content into posters, banners and short videos.",
    emoji: "🎨",
  },
  {
    icon: Users,
    title: "Community outreach",
    body: "Talk to local residents and businesses about waste and recycling habits.",
    emoji: "🤝",
  },
  {
    icon: Sprout,
    title: "Green campus audit",
    body: "Walk the campus, photograph problem spots and propose fixes.",
    emoji: "🌱",
  },
  {
    icon: BookOpen,
    title: "Awareness booth",
    body: "Run an information stand with quizzes and reusable giveaways.",
    emoji: "📚",
  },
  {
    icon: Megaphone,
    title: "Social media campaign",
    body: "Publish the team's message and follow the response.",
    emoji: "📣",
  },
];

export function Activities() {
  return (
    <section id="activities" className="scroll-mt-24 bg-canopy py-16 sm:py-20">
      <div className="container-page">
        <Reveal from="up" className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-azure-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-azure-600">
            <HandHeart className="h-3.5 w-3.5" aria-hidden="true" />
            Get involved
          </span>
          <h2 className="mt-5 text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            Choose your activity
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
            Everyone takes part in the awareness sessions. Then pick the activity team that
            matches what you enjoy doing.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <Reveal
                as="li"
                key={activity.title}
                from="up"
                delay={index * 70}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-leaf-300 hover:shadow-lift"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-leaf-100 text-leaf-700 transition group-hover:bg-leaf-600 group-hover:text-white">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-leaf-950">{activity.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{activity.body}</p>
                <span className="mt-3 inline-block text-2xl" aria-hidden="true">
                  {activity.emoji}
                </span>
              </Reveal>
            );
          })}
        </ul>

        <Reveal from="up" delay={140} className="mt-10 text-center">
          <ButtonLink href="/event" variant="secondary" size="lg">
            See the full programme
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/** Why the draw is trustworthy — the trust section. */
export function Fairness() {
  const points = [
    {
      title: "Only verified participants",
      body: "You need to actually take part. The organiser confirms attendance, and only confirmed participants enter the draw.",
    },
    {
      title: "The list is frozen first",
      body: "When the draw starts, the participant list is locked and hashed. Nobody can join, leave or swap afterwards.",
    },
    {
      title: "Selected by the server",
      body: "The winner is picked by a cryptographically secure random generator on the server. The animation only reveals a result that already exists.",
    },
    {
      title: "Anyone can check it",
      body: "Afterwards we publish the randomness fingerprint and the participant-list fingerprint, so the result can be independently re-derived.",
    },
  ];

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal from="left">
          <span className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Fair play
          </span>
          <h2 className="mt-5 text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            A lucky draw you can actually trust
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Most event draws are a black box. This one is not. The rules are published, the pool is
            frozen before anything is selected, and the randomness is verifiable afterwards.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/rules" variant="outline">
              Read the draw rules
            </ButtonLink>
            <ButtonLink href="/winners" variant="ghost">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              See past winners
            </ButtonLink>
          </div>
        </Reveal>

        <ul className="grid gap-4">
          {points.map((point, index) => (
            <Reveal
              as="li"
              key={point.title}
              from="right"
              delay={index * 80}
              className="flex gap-4 rounded-2xl border border-leaf-100 bg-leaf-50/60 p-5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-leaf-600 text-sm font-extrabold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="font-bold text-leaf-950">{point.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Impact() {
  return (
    <section className="bg-canopy py-16 sm:py-20">
      <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal from="left">
          <ImpactArt className="w-full rounded-3xl shadow-lift" />
        </Reveal>
        <Reveal from="right" delay={100}>
          <span className="inline-flex items-center gap-2 rounded-full bg-gold-300/50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-gold-600">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Why we do it
          </span>
          <h2 className="mt-5 text-3xl font-extrabold text-leaf-950 sm:text-4xl">
            Serving Beyond Borders — Together We Grow
          </h2>
          <div className="mt-4 space-y-3 text-lg leading-relaxed text-slate-600">
            <p>
              Helping Station is a student-led programme about two things at once: taking care of
              the environment we share, and taking care of the people around us.
            </p>
            <p>
              It is run by students, for students. There is no fee, no membership, and no
              experience required — just a willingness to spend a day learning, creating and doing
              something useful. Prizes are a small thank-you, never the reason to come.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/register" size="lg">
              🎟️ Take part
            </ButtonLink>
            <Link
              href="/privacy"
              className="inline-flex h-13 items-center rounded-full px-2 text-sm font-semibold text-leaf-800 underline-offset-4 hover:underline"
            >
              How we handle your data
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
