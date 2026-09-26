import { describe, expect, it } from "vitest";
import {
  initials,
  maskEmail,
  maskName,
  maskPhone,
  maskStudentId,
  publicWinnerLabel,
  MASK,
} from "@/lib/privacy";

describe("maskName", () => {
  it("keeps a recognisable shape without revealing the name", () => {
    expect(maskName("Minseok Kim")).toBe("Min*** K");
    expect(maskName("Minjun Park Jr")).toBe("Min*** J");
  });

  it("masks a single Latin name down to two letters", () => {
    expect(maskName("Min")).toBe("Mi***");
  });

  it("keeps the outer glyphs of a CJK name", () => {
    // 한글: first and last glyph survive, the middle is hidden.
    const masked = maskName("김민준");
    expect(masked).toContain(MASK);
    expect(masked.startsWith("김")).toBe(true);
    expect(masked.endsWith("준")).toBe(true);
    expect(masked).not.toContain("민");
  });

  it("handles a one-character name without an index error", () => {
    expect(maskName("A")).toBe("A***");
    expect(maskName("김")).toBe(`김${MASK}`);
  });

  it("falls back to a neutral label for an empty name", () => {
    expect(maskName("   ")).toBe("Participant");
    expect(maskName("")).toBe("Participant");
  });

  it("normalises whitespace before masking", () => {
    expect(maskName("  Minseok   Kim  ")).toBe("Min*** K");
  });

  it("never returns the original name in full", () => {
    for (const name of ["Minseok Kim", "김민준", "Ana", "Jean-Luc Picard"]) {
      expect(maskName(name)).not.toBe(name);
    }
  });
});

describe("maskStudentId", () => {
  it("keeps only the last four characters", () => {
    expect(maskStudentId("20231234")).toBe(`${MASK}1234`);
  });

  it("reveals nothing for a short identifier", () => {
    expect(maskStudentId("123")).toBe(MASK);
    expect(maskStudentId("1234")).toBe(MASK);
  });

  it("trims before masking", () => {
    expect(maskStudentId("  20231234  ")).toBe(`${MASK}1234`);
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the domain", () => {
    expect(maskEmail("minseok@deu.ac.kr")).toBe("m***@deu.ac.kr");
  });

  it("does not reveal the local part beyond one character", () => {
    const masked = maskEmail("minseok.kim@deu.ac.kr");
    expect(masked).not.toContain("minseok");
    expect(masked).not.toContain("kim");
  });

  it("returns the mask alone for something that is not an address", () => {
    expect(maskEmail("nonsense")).toBe(MASK);
    expect(maskEmail("")).toBe(MASK);
  });
});

describe("maskPhone", () => {
  it("keeps the last four digits", () => {
    expect(maskPhone("010-1234-5678")).toBe("*******5678");
  });

  it("ignores formatting characters", () => {
    // 12 digits, last 4 kept, so 8 stars.
    expect(maskPhone("+82 10 1234 5678")).toBe(`${"*".repeat(8)}5678`);
  });

  it("reveals nothing for a very short number", () => {
    expect(maskPhone("12")).toBe(MASK);
    expect(maskPhone("")).toBe(MASK);
  });
});

describe("initials", () => {
  it("uses the first and last word", () => {
    expect(initials("Minseok Kim")).toBe("MK");
    expect(initials("Ana Maria Lopez")).toBe("AL");
  });

  it("handles one word and empty input", () => {
    expect(initials("Cher")).toBe("CH");
    expect(initials("  ")).toBe("HS");
  });
});

describe("publicWinnerLabel", () => {
  const winner = { displayName: "Minseok Kim", consented: true };

  it("shows a masked name when the participant consented", () => {
    expect(publicWinnerLabel({ ...winner, displayMode: "MASKED" })).toBe("Min*** K");
  });

  it("shows nothing without consent, even in masked mode", () => {
    // The important case: opting out is absolute, not a preference.
    expect(publicWinnerLabel({ ...winner, consented: false, displayMode: "MASKED" })).toBeNull();
  });

  it("shows nothing in NONE mode regardless of consent", () => {
    expect(publicWinnerLabel({ ...winner, displayMode: "NONE" })).toBeNull();
    expect(publicWinnerLabel({ ...winner, consented: false, displayMode: "NONE" })).toBeNull();
  });

  it("never returns the unmasked name", () => {
    const label = publicWinnerLabel({ ...winner, displayMode: "MASKED" });
    expect(label).not.toBe("Minseok Kim");
  });
});
