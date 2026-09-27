import { describe, expect, it } from "vitest";
import { siteSettingsInputSchema, SITE_SECTIONS, OPEN_SETTINGS } from "@/lib/site-settings";

/**
 * Site section switches.
 *
 * `getSiteSettings` and friends touch Prisma, so they are verified against a real
 * database elsewhere. What is pinned here is the part that is pure logic and the
 * part that is easiest to break silently: the shape of the input, and the
 * agreement between `SITE_SECTIONS` and the fields on the settings object.
 */
describe("siteSettingsInputSchema", () => {
  const allOn = {
    siteOpen: true,
    registerOpen: true,
    winnersOpen: true,
    drawOpen: true,
    rulesOpen: true,
    showCount: true,
    closedNote: "",
  };

  it("accepts everything open", () => {
    const result = siteSettingsInputSchema.safeParse(allOn);
    expect(result.success).toBe(true);
  });

  it("accepts everything closed", () => {
    const result = siteSettingsInputSchema.safeParse({
      ...allOn,
      siteOpen: false,
      registerOpen: false,
      winnersOpen: false,
      drawOpen: false,
      rulesOpen: false,
      showCount: false,
    });
    expect(result.success).toBe(true);
  });

  it("trims the closed-page note", () => {
    const result = siteSettingsInputSchema.safeParse({
      ...allOn,
      closedNote: "  Back on Monday  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.closedNote).toBe("Back on Monday");
  });

  it("rejects a note long enough to break the layout", () => {
    const result = siteSettingsInputSchema.safeParse({
      ...allOn,
      closedNote: "x".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing switch rather than defaulting it", () => {
    // A switch that is absent must fail loudly. Defaulting it to `true` would
    // mean a malformed form silently reopens a section somebody closed.
    const { registerOpen: _omitted, ...withoutRegister } = allOn;
    expect(siteSettingsInputSchema.safeParse(withoutRegister).success).toBe(false);
  });
});

describe("SITE_SECTIONS agrees with the settings shape", () => {
  it("every section key is a real field on the settings", () => {
    // This is the check that would have caught the earlier `register` vs
    // `registerOpen` mismatch, which typechecked but read `undefined` at runtime
    // and so silently reported every section as closed.
    for (const section of SITE_SECTIONS) {
      expect(
        section.key in OPEN_SETTINGS,
        `"${section.key}" is not a field on the settings object`,
      ).toBe(true);
    }
  });

  it("every section key is boolean in the fallback", () => {
    for (const section of SITE_SECTIONS) {
      expect(typeof OPEN_SETTINGS[section.key]).toBe("boolean");
    }
  });

  it("section keys are unique", () => {
    const keys = SITE_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("a fresh install is fully open", () => {
    // The fail-safe: if the table cannot be read, nothing is closed.
    expect(OPEN_SETTINGS.siteOpen).toBe(true);
    for (const section of SITE_SECTIONS) {
      expect(OPEN_SETTINGS[section.key]).toBe(true);
    }
  });

  it("the list is not empty, or there would be nothing to control", () => {
    expect(SITE_SECTIONS.length).toBeGreaterThan(0);
  });
});
