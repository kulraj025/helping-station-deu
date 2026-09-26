/** Formatting helpers shared by server and client components. */

export function formatEventDate(iso: string | Date, locale = "en-US"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatEventDateShort(iso: string | Date, locale = "en-US"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

export function formatTime(iso: string | Date, locale = "en-US"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTimeRange(startIso: string | Date, endIso: string | Date, locale = "en-US") {
  return `${formatTime(startIso, locale)} – ${formatTime(endIso, locale)}`;
}

export function formatDateTime(iso: string | Date, locale = "en-US"): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTimeUtc(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function formatRelativeDeadline(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return "Registration has closed";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  return `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"} left`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
