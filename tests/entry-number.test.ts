import { describe, expect, it } from "vitest";
import {
  extractSequence,
  isDemoEntryNumber,
  nextEntryNumber,
  padEntryNumber,
  splitEntryNumber,
} from "@/lib/entry-number";
import { slugify } from "@/lib/utils";

describe("padEntryNumber", () => {
  it("pads to four digits", () => {
    expect(padEntryNumber(1)).toBe("HS-0001");
    expect(padEntryNumber(42)).toBe("HS-0042");
    expect(padEntryNumber(1234)).toBe("HS-1234");
  });

  it("marks demo numbers with a DEMO segment", () => {
    expect(padEntryNumber(7, true)).toBe("HS-DEMO-0007");
    expect(isDemoEntryNumber(padEntryNumber(7, true))).toBe(true);
    expect(isDemoEntryNumber(padEntryNumber(7))).toBe(false);
  });

  it("does not truncate a number wider than the padding", () => {
    expect(padEntryNumber(12345)).toBe("HS-12345");
  });
});

describe("extractSequence", () => {
  it("reads the sequence out of either prefix", () => {
    expect(extractSequence("HS-0042")).toBe(42);
    expect(extractSequence("HS-DEMO-0042")).toBe(42);
  });

  it("returns null when there are no digits", () => {
    expect(extractSequence("HS-")).toBeNull();
    expect(extractSequence("")).toBeNull();
  });
});

describe("nextEntryNumber", () => {
  it("starts at one for an empty event", () => {
    expect(nextEntryNumber([])).toBe("HS-0001");
  });

  it("continues from the highest number, not the count", () => {
    // A gap must not cause a collision.
    expect(nextEntryNumber(["HS-0001", "HS-0002", "HS-0009"])).toBe("HS-0010");
  });

  it("is order independent", () => {
    const numbers = ["HS-0300", "HS-0001", "HS-0200"];
    expect(nextEntryNumber(numbers)).toBe("HS-0301");
    expect(nextEntryNumber([...numbers].reverse())).toBe("HS-0301");
  });

  it("keeps demo numbers in the demo range", () => {
    const next = nextEntryNumber(["HS-DEMO-0001", "HS-DEMO-0002"], true);
    expect(next).toBe("HS-DEMO-0003");
    expect(isDemoEntryNumber(next)).toBe(true);
  });

  it("never produces a duplicate for a full list of consecutive numbers", () => {
    const existing = Array.from({ length: 50 }, (_, index) => padEntryNumber(index + 1));
    const next = nextEntryNumber(existing);
    expect(existing).not.toContain(next);
  });
});

describe("splitEntryNumber", () => {
  it("splits at the first dash for the reveal animation", () => {
    expect(splitEntryNumber("HS-0042")).toEqual(["HS-", "0042"]);
  });

  it("handles the demo prefix", () => {
    expect(splitEntryNumber("HS-DEMO-0007")).toEqual(["HS-", "DEMO-0007"]);
  });

  it("returns the whole string when there is no dash", () => {
    expect(splitEntryNumber("nonsense")).toEqual(["nonsense", ""]);
  });
});

describe("slugify", () => {
  it("lower-cases and dash-separates", () => {
    expect(slugify("Helping Station DEU")).toBe("helping-station-deu");
  });

  it("collapses punctuation and whitespace", () => {
    expect(slugify("Spring  Edition — 2026!")).toBe("spring-edition-2026");
  });

  it("keeps non-Latin letters", () => {
    expect(slugify("행복-station")).toBe("행복-station");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  ---Hello---  ")).toBe("hello");
  });

  it("never returns an empty slug", () => {
    // A URL of "/" would be a broken share link, so this matters.
    expect(slugify("!!!")).toBe("event");
    expect(slugify("")).toBe("event");
  });

  it("respects the length cap without leaving a trailing dash", () => {
    const slug = slugify("a".repeat(200), 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
  });
});
