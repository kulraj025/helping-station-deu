import { revalidatePath } from "next/cache";
import { getEventById } from "@/server/services/event-service";

/**
 * Shared cache invalidation for a draw-affecting change.
 *
 * A single place to remember every surface that has to be re-rendered when the
 * pool, a prize or an event's dates change: the public draw screen polls its own
 * endpoint, but the winners page and the homepage are server-rendered.
 */
export function revalidateDrawCaches(eventId: string): void {
  revalidatePath("/");
  revalidatePath("/draw");
  revalidatePath("/draw/display");
  revalidatePath("/winners");
  revalidatePath("/event");
  revalidatePath("/register");
  revalidatePath("/api/public/draw-state");
  revalidatePath(`/admin/draw?event=${eventId}`);
  revalidatePath(`/admin/prizes?event=${eventId}`);
  revalidatePath(`/admin/eligibility?event=${eventId}`);
}

/** Warms nothing, but validates the event id early so callers fail loudly. */
export async function assertEventExists(eventId: string): Promise<void> {
  const event = await getEventById(eventId);
  if (!event) throw new Error(`Event ${eventId} does not exist.`);
}
