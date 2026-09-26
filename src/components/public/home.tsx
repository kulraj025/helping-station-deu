"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, MapPin, CalendarDays, Clock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HeroArt } from "@/components/site/illustrations";
import { CountUp, Reveal } from "@/components/ui/reveal";

export interface HeroEvent {
  name: string;
  tagline: string | null;
  startAt: string;
  timeLabel: string;
  locationName: string;
  registrationOpen: boolean;
  participants: number | null;
}

const floatingIcons = [
  { emoji: "🌱", className: "left-[4%] top-[18%] animate-float", delay: "0s" },
  { emoji: "♻️", className: "right-[6%] top-[12%] animate-float-slow", delay: ".6s" },
  { emoji: "🌍", className: "right-[2%] bottom-[22%] animate-float", delay: "1.1s" },
  { emoji: "🧹", className: "left-[8%] bottom-[16%] animate-float-slow", delay: "1.6s" },
  { emoji: "🎨", className: "left-[46%] top-[4%] animate-float", delay: ".3s" },
];

export function Hero({ event }: { event: HeroEvent | null }) {
  const dateLabel = event
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(event.startAt))
    : null;

  return (
    <section className="bg-canopy relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      {/* decorative grid + blobs */}
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-leaf-200/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-azure-200/40 blur-3xl"
        aria-hidden="true"
      />

      {/* floating eco icons */}
      {floatingIcons.map((icon) => (
        <span
          key={icon.emoji}
          className={`pointer-events-none absolute hidden text-3xl opacity-70 md:block ${icon.className}`}
          style={{ animationDelay: icon.delay }}
          aria-hidden="true"
        >
          {icon.emoji}
        </span>
      ))}

      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div>
            <Reveal from="up">
              <span className="inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800 shadow-soft backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Social &amp; Environmental Awareness
              </span>
            </Reveal>

            <Reveal from="up" delay={80}>
              <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.03] tracking-tight text-leaf-950 sm:text-6xl lg:text-[4.1rem]">
                <span className="block">🌱 Helping Station</span>
                <span className="text-gradient block">DEU</span>
              </h1>
            </Reveal>

            <Reveal from="up" delay={160}>
              <p className="mt-5 max-w-xl text-lg font-bold leading-snug text-slate-800 sm:text-xl">
                Learn. Participate. Take Action.{" "}
                <span className="text-leaf-700">Grow Together.</span>
              </p>
            </Reveal>

            <Reveal from="up" delay={240}>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-[1.05rem]">
                A student-led social and environmental awareness and volunteer action program
                connecting students, the university, and the wider community.
              </p>
            </Reveal>

            <Reveal from="up" delay={320}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/register" size="lg" className="w-full sm:w-auto">
                  🎟️ Register for the Event
                </ButtonLink>
                <ButtonLink href="/event" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Learn About Helping Station
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </Reveal>

            {event ? (
              <Reveal from="up" delay={400}>
                <div className="mt-8 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3.5 text-sm shadow-soft backdrop-blur">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <CalendarDays className="h-4 w-4 text-leaf-600" aria-hidden="true" />
                    {dateLabel}
                  </span>
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <Clock className="h-4 w-4 text-azure-500" aria-hidden="true" />
                    {event.timeLabel}
                  </span>
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <MapPin className="h-4 w-4 text-gold-500" aria-hidden="true" />
                    {event.locationName}
                  </span>
                  {event.participants !== null ? (
                    <span className="flex items-center gap-2 font-semibold text-slate-700">
                      <span aria-hidden="true">👥</span>
                      <CountUp to={event.participants} /> registered
                    </span>
                  ) : null}
                </div>
              </Reveal>
            ) : null}
          </div>

          <Reveal from="zoom" delay={200} className="relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div
                className="absolute inset-4 rounded-[2.5rem] bg-leaf-300/30 blur-2xl"
                aria-hidden="true"
              />
              <HeroArt className="relative h-auto w-full animate-float-slow drop-shadow-xl" />
              <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
                {[
                  { label: "Awareness", emoji: "📚" },
                  { label: "Action", emoji: "🧹" },
                  { label: "Teamwork", emoji: "🤝" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-soft backdrop-blur"
                  >
                    <span aria-hidden="true">{chip.emoji}</span>
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Infinite scrolling tag strip — pure CSS, pauses under reduced motion. */
export function ActivityMarquee() {
  const tags = [
    "🎨 Poster making",
    "♻️ Recycling",
    "🧹 Campus clean-up",
    "🌱 Tree planting",
    "🗣️ Group showcase",
    "📚 Awareness session",
    "🗑️ Waste separation",
    "🤝 Community volunteering",
    "💡 Campus campaigns",
    "🌍 Environmental protection",
  ];
  const row = [...tags, ...tags];

  return (
    <div className="marquee-mask relative overflow-hidden border-y border-leaf-200/60 bg-leaf-50/70 py-4">
      <div className="flex w-max animate-marquee items-center gap-3">
        {row.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="whitespace-nowrap rounded-full border border-leaf-200 bg-white px-4 py-2 text-sm font-semibold text-leaf-800 shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeCta() {
  return (
    <section className="relative overflow-hidden bg-leaf-900 py-16 text-white sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-30" aria-hidden="true" />
      <div className="container-page relative text-center">
        <Reveal from="up">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Small Actions. Real Impact.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-leaf-100/85">
            Every student can contribute. Learn something new. Work with others. Take action. Help
            your community. Grow together.
          </p>
        </Reveal>
        <Reveal from="up" delay={140}>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/register" size="xl" variant="gold">
              Join Helping Station DEU
            </ButtonLink>
            <ButtonLink
              href="/event"
              size="xl"
              variant="secondary"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              See the programme
            </ButtonLink>
          </div>
        </Reveal>
        <Reveal from="up" delay={220}>
          <p className="mt-6 text-sm font-semibold text-leaf-200/80">
            Serving Beyond Borders — Together We Grow.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export { Link };
