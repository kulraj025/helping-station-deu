import type { Metadata } from "next";
import { getPrimaryEvent, getPublicStats, isRegistrationOpen } from "@/server/services/event-service";
import { prisma } from "@/lib/prisma";
import { ActivityMarquee, Hero } from "@/components/public/home";
import { Activities, Fairness, Impact, Journey, StatsStrip } from "@/components/public/sections";
import { formatTimeRange } from "@/lib/format";

export const metadata: Metadata = {
  title: "Serving Beyond Borders — Student Volunteer Programme",
  description:
    "Helping Station DEU is a student-led social and environmental awareness and volunteer action programme at Dong-Eui University. Learn, participate, take action and grow together.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const event = await getPrimaryEvent();

  let participants: number | null = null;
  let prizes = 0;
  if (event) {
    const [stats, prizeRows] = await Promise.all([
      getPublicStats(event.id),
      prisma.prize.aggregate({ where: { eventId: event.id }, _sum: { quantity: true } }),
    ]);
    participants = stats.totalParticipants;
    prizes = prizeRows._sum.quantity ?? 0;
  }

  return (
    <>
      <Hero
        event={
          event
            ? {
                name: event.name,
                tagline: event.tagline,
                startAt: event.startAt.toISOString(),
                timeLabel: formatTimeRange(event.startAt, event.endAt),
                locationName: event.locationName,
                registrationOpen: isRegistrationOpen(event),
                participants,
              }
            : null
        }
      />
      <ActivityMarquee />
      <StatsStrip participants={participants} activities={6} prizes={prizes} />
      <Journey />
      <Activities />
      <Fairness />
      <Impact />
    </>
  );
}
