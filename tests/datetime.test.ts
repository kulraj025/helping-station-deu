import { describe, expect, it } from "vitest";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "@/lib/datetime";

/**
 * The whole point of this module is that the two directions agree. If they
 * drift, every organiser who saves an event silently shifts its start, end and
 * deadline — which is exactly the bug that made `/admin/events/[id]` unusable.
 */
describe("toDateTimeLocalValue", () => {
  it("formats a Date as YYYY-MM-DDTHH:mm with no trailing Z", () => {
    const value = toDateTimeLocalValue(new Date(2026, 10, 9, 9, 5));
    expect(value).toBe("2026-11-09T09:05");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("produces something a datetime-local input accepts", () => {
    // A full ISO string ("...T10:00:00.000Z") is rejected by the control and
    // renders as an empty field, which is how the create form used to behave.
    const value = toDateTimeLocalValue(new Date(2026, 10, 9, 10, 0));
    expect(value).not.toContain("Z");
    expect(value.endsWith("Z")).toBe(false);
    expect(Number.isNaN(new Date(value).getTime())).toBe(false);
  });

  it("zero-pads single-digit months, days, hours and minutes", () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });

  it("returns an empty string for missing or unparsable input", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(undefined)).toBe("");
    expect(toDateTimeLocalValue("")).toBe("");
    expect(toDateTimeLocalValue("not-a-date")).toBe("");
  });

  it("accepts a parsable string as well as a Date", () => {
    expect(toDateTimeLocalValue(new Date(2026, 10, 9, 9, 5).toISOString())).toBe("2026-11-09T09:05");
  });
});

describe("dateTimeLocalToIso", () => {
  it("turns a bare datetime-local value into an ISO instant", () => {
    const iso = dateTimeLocalToIso("2026-11-09T09:05");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("reads the value as local wall clock, matching toDateTimeLocalValue", () => {
    // ES spec: a date-time form with no offset is local time, so the instant
    // carries whatever offset the server is running in.
    const iso = dateTimeLocalToIso("2026-11-09T09:05");
    expect(new Date(iso).getHours()).toBe(9);
    expect(new Date(iso).getMinutes()).toBe(5);
  });

  it("returns an empty string for unusable input instead of an Invalid Date", () => {
    expect(dateTimeLocalToIso("")).toBe("");
    expect(dateTimeLocalToIso("garbage")).toBe("");
  });

  it("passes through a value that already carries an offset", () => {
    expect(dateTimeLocalToIso("2026-11-09T09:05:00Z")).toBe("2026-11-09T09:05:00.000Z");
    expect(dateTimeLocalToIso("2026-11-09T09:05:00+09:00")).toBe("2026-11-09T00:05:00.000Z");
  });
});

describe("round trip", () => {
  it("is lossless: saving an event does not move it", () => {
    for (const [month, day, hour] of [
      [0, 1, 0],
      [2, 29, 23],
      [10, 9, 9],
      [11, 31, 18],
    ] as const) {
      const original = new Date(2026, month, day, hour, 30);
      const rendered = toDateTimeLocalValue(original);
      const saved = dateTimeLocalToIso(rendered);
      expect(new Date(saved).getTime()).toBe(original.getTime());
    }
  });

  it("survives repeated save cycles without drift", () => {
    let instant = new Date(2026, 10, 9, 9, 0).getTime();
    const start = instant;
    for (let i = 0; i < 5; i += 1) {
      instant = new Date(dateTimeLocalToIso(toDateTimeLocalValue(new Date(instant)))).getTime();
    }
    expect(instant).toBe(start);
  });
});