/**
 * `datetime-local` helpers.
 *
 * A `<input type="datetime-local">` has no timezone: it submits a bare
 * `YYYY-MM-DDTHH:mm`. This module is the single place that decides what that
 * bare string means, because the two directions have to agree or every save
 * silently shifts the event.
 *
 * Convention: the value is the wall-clock time of the **server**, not the
 * browser. `dateTimeLocalToIso` parses it the way `new Date("2026-11-24T10:00")`
 * does — as local time — and `toDateTimeLocalValue` converts an instant back to
 * that same local wall-clock. The round-trip is therefore exact no matter which
 * timezone the organiser's browser is in, and it does not move when the server
 * timezone changes.
 *
 * This file must stay free of `"use client"` and `"server-only"`: both the admin
 * form (client) and the admin event pages (server) need it. An earlier version
 * of `toDateTimeLocalValue` lived inside the `"use client"` event form and was
 * called straight from the server-rendered edit page, which React rejects —
 * `/admin/events/[id]` returned HTTP 500 for every organiser.
 */

/** Date (or parsable string) → `YYYY-MM-DDTHH:mm` for a `datetime-local` input. */
export function toDateTimeLocalValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * `YYYY-MM-DDTHH:mm` → ISO string, or `""` when the input is unusable.
 *
 * Matches `new Date("2026-11-24T10:00")`, which the ECMAScript spec defines as
 * *local* time for a date-time form with no offset (date-only forms are UTC).
 */
export function dateTimeLocalToIso(value: string): string {
  if (!value) return "";
  // A full ISO string with an offset already carries its own zone; let Date
  // handle it rather than stripping it.
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const absolute = new Date(value);
    return Number.isNaN(absolute.getTime()) ? "" : absolute.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
