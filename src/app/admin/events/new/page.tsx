import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { PageBody, PageHeader, Panel } from "@/components/admin/page-parts";
import { EventForm, type EventFormValues } from "@/components/admin/event-form";
import { toDateTimeLocalValue } from "@/lib/datetime";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "New event" };
export const dynamic = "force-dynamic";

/** Sensible defaults: an event three weeks out, deadline in a week. */
function defaultValues(): EventFormValues {
  const now = new Date();
  const start = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
  const deadline = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    name: "",
    tagline: "",
    description: "",
    locationName: "",
    locationAddress: "",
    startAt: toDateTimeLocalValue(start),
    endAt: toDateTimeLocalValue(end),
    registrationDeadline: toDateTimeLocalValue(deadline),
    capacity: "",
    organizerName: "",
    organizerDepartment: "",
    organizerContact: "",
    status: "DRAFT",
    isDemo: env.demoMode,
    settings: {
      requireParticipationForEligibility: true,
      allowMultipleWinsPerParticipant: false,
      winnerDisplayMode: "MASKED",
      publicWinnersVisible: true,
      publicDrawScreenVisible: true,
      showParticipantCount: true,
      claimWindowDays: "14",
      requireDrawConsent: true,
      requireEmergencyContact: false,
      prizeClaimNote: "",
      winnerContactMethod:
        "The organiser contacts each winner using the e-mail address and phone number collected at registration.",
      complianceNote: "",
    },
  };
}

export default async function NewEventPage() {
  const admin = await requireAdmin("/admin/events");

  return (
    <PageBody className="max-w-4xl">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-leaf-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All events
      </Link>

      <PageHeader
        title="New event"
        description="Create the event first; add prizes and open registration once the details are right."
      />

      <Panel>
        <EventForm
          mode="create"
          values={{
            ...defaultValues(),
            organizerName: admin.name,
            organizerContact: admin.email,
          }}
        />
      </Panel>
    </PageBody>
  );
}
