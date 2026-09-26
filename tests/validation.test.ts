import { describe, expect, it } from "vitest";
import {
  adminLoginSchema,
  bulkUpdateSchema,
  claimUpdateSchema,
  correctionSchema,
  eventSchema,
  isAcademicEmail,
  participantUpdateSchema,
  prizeSchema,
  registerSchema,
  sanitizeText,
  setPasswordSchema,
  studentLoginSchema,
} from "@/lib/validation";
import { eventSettingsSchema, parseEventSettings } from "@/lib/event-settings";

const goodEvent = {
  name: "Helping Station DEU — Spring Edition",
  description: "A day of volunteering, food and prizes for the whole campus community.",
  locationName: "DEU Main Hall",
  startAt: "2026-06-20T10:00:00.000Z",
  endAt: "2026-06-20T16:00:00.000Z",
  registrationDeadline: "2026-06-13T10:00:00.000Z",
  status: "PUBLISHED",
  organizerName: "Student Union",
};

const goodRegistration = {
  eventId: "evt_1",
  fullName: "Minseok Kim",
  email: "minseok@deu.ac.kr",
  studentId: "20231234",
  department: "Computer Science",
  phone: "010-1234-5678",
  agreeRules: true,
  dataConsent: true,
  drawConsent: true,
};

describe("sanitizeText", () => {
  it("strips control characters", () => {
    expect(sanitizeText("a\u0000b\u001fc\u007fd")).toBe("a b c d");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeText("  Minseok   \n  Kim  ")).toBe("Minseok Kim");
  });

  it("caps the length", () => {
    expect(sanitizeText("x".repeat(1000), 50)).toHaveLength(50);
  });
});

describe("registerSchema", () => {
  it("accepts a complete, consented registration", () => {
    const result = registerSchema.safeParse(goodRegistration);
    expect(result.success).toBe(true);
  });

  it("requires both mandatory consents", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, agreeRules: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...goodRegistration, dataConsent: false }).success).toBe(false);
  });

  it("requires the draw consent separately", () => {
    // The whole fairness argument depends on this, so it is a hard failure
    // rather than a default.
    const result = registerSchema.safeParse({ ...goodRegistration, drawConsent: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "drawConsent")).toBe(true);
    }
  });

  it("rejects a filled honeypot", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, website: "http://spam" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...goodRegistration, website: "" }).success).toBe(true);
  });

  it("rejects a malformed e-mail", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, email: "not-an-email" }).success).toBe(false);
  });

  it("normalises the e-mail to lower case", () => {
    const result = registerSchema.safeParse({ ...goodRegistration, email: "  Minseok@DEU.ac.KR " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("minseok@deu.ac.kr");
  });

  it("normalises the student ID to upper case", () => {
    const result = registerSchema.safeParse({ ...goodRegistration, studentId: " 2023-ab " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.studentId).toBe("2023-AB");
  });

  it("rejects a student ID with disallowed characters", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, studentId: "2023/1234" }).success).toBe(false);
  });

  it("rejects a phone number with letters", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, phone: "010-ABCD-5678" }).success).toBe(false);
  });

  it("requires the emergency contact as a pair", () => {
    const onlyName = registerSchema.safeParse({
      ...goodRegistration,
      emergencyContactName: "Kim Senior",
    });
    expect(onlyName.success).toBe(false);

    const both = registerSchema.safeParse({
      ...goodRegistration,
      emergencyContactName: "Kim Senior",
      emergencyContactPhone: "010-9999-8888",
    });
    expect(both.success).toBe(true);
  });

  it("rejects an unknown volunteer role", () => {
    expect(registerSchema.safeParse({ ...goodRegistration, volunteerRole: "Chief" }).success).toBe(false);
  });

  it("defaults the optional consents to false", () => {
    const result = registerSchema.safeParse(goodRegistration);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publicDisplayConsent).toBe(false);
      expect(result.data.contactConsent).toBe(false);
    }
  });
});

describe("isAcademicEmail", () => {
  it("recognises university domains", () => {
    for (const email of [
      "a@deu.ac.kr",
      "a@mail.hanyang.ac.kr",
      "a@u-tokyo.ac.jp",
      "a@mit.edu",
      "a@unimelb.edu.au",
    ]) {
      expect(isAcademicEmail(email)).toBe(true);
    }
  });

  it("rejects commercial domains that merely look similar", () => {
    for (const email of ["a@gmail.com", "a@notedu.com", "a@ac.kr.example.com", "a@fake.edu.ph"]) {
      expect(isAcademicEmail(email)).toBe(false);
    }
  });
});

describe("login schemas", () => {
  it("accepts a normal student sign-in", () => {
    expect(studentLoginSchema.safeParse({ identifier: "a@deu.ac.kr", password: "correct horse" }).success).toBe(true);
  });

  it("rejects a bad student password", () => {
    expect(studentLoginSchema.safeParse({ identifier: "a@deu.ac.kr", password: "" }).success).toBe(false);
  });

  it("requires at least 8 characters for an admin password", () => {
    expect(adminLoginSchema.safeParse({ email: "a@deu.ac.kr", password: "short" }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ email: "a@deu.ac.kr", password: "longenough" }).success).toBe(true);
  });

  it("rejects an admin login that fills the honeypot", () => {
    expect(
      adminLoginSchema.safeParse({ email: "a@deu.ac.kr", password: "longenough", website: "x" }).success,
    ).toBe(false);
  });

  it("upper-cases a claim code and enforces its format", () => {
    const result = setPasswordSchema.safeParse({
      password: "GoodPassword1",
      confirmPassword: "GoodPassword1",
    });
    expect(result.success).toBe(true);
  });

  it("enforces password strength and confirmation", () => {
    expect(setPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(
      setPasswordSchema.safeParse({ password: "alllowercase1", confirmPassword: "alllowercase1" }).success,
    ).toBe(false);
    expect(
      setPasswordSchema.safeParse({ password: "GoodPassword1", confirmPassword: "GoodPassword2" }).success,
    ).toBe(false);
  });
});

describe("eventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(eventSchema.safeParse(goodEvent).success).toBe(true);
  });

  it("rejects a deadline after the start", () => {
    const result = eventSchema.safeParse({
      ...goodEvent,
      registrationDeadline: "2026-06-25T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "registrationDeadline")).toBe(true);
    }
  });

  it("rejects an end at or before the start", () => {
    expect(eventSchema.safeParse({ ...goodEvent, endAt: "2026-06-20T10:00:00.000Z" }).success).toBe(false);
  });

  it("rejects an unparseable date", () => {
    expect(eventSchema.safeParse({ ...goodEvent, startAt: "not a date" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(eventSchema.safeParse({ ...goodEvent, status: "SOMEDAY" }).success).toBe(false);
  });

  it("requires a substantial description", () => {
    expect(eventSchema.safeParse({ ...goodEvent, description: "Short" }).success).toBe(false);
  });

  it("treats a blank capacity as no limit", () => {
    const result = eventSchema.safeParse({ ...goodEvent, capacity: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capacity).toBeNull();
  });

  it("applies the safer defaults for draw rules", () => {
    const result = eventSchema.safeParse(goodEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      // Attendance-gated eligibility, one win per person, masked public names.
      expect(result.data.requireParticipationForEligibility).toBe(true);
      expect(result.data.allowMultipleWinsPerParticipant).toBe(false);
      expect(result.data.winnerDisplayMode).toBe("MASKED");
      expect(result.data.claimWindowDays).toBe(14);
    }
  });

  it("rejects an out-of-range claim window", () => {
    expect(eventSchema.safeParse({ ...goodEvent, claimWindowDays: 0 }).success).toBe(false);
    expect(eventSchema.safeParse({ ...goodEvent, claimWindowDays: 400 }).success).toBe(false);
  });
});

describe("prizeSchema", () => {
  const goodPrize = { eventId: "evt_1", name: "Cash voucher", quantity: 1 };

  it("accepts a valid prize", () => {
    expect(prizeSchema.safeParse(goodPrize).success).toBe(true);
  });

  it("requires at least one winner", () => {
    expect(prizeSchema.safeParse({ ...goodPrize, quantity: 0 }).success).toBe(false);
  });

  it("coerces a form string quantity", () => {
    const result = prizeSchema.safeParse({ ...goodPrize, quantity: "3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(3);
  });

  it("refuses an absurd quantity", () => {
    expect(prizeSchema.safeParse({ ...goodPrize, quantity: 100_000 }).success).toBe(false);
  });
});

describe("participant schemas", () => {
  it("requires at least one field to change", () => {
    expect(participantUpdateSchema.safeParse({ registrationId: "r1" }).success).toBe(false);
    expect(
      participantUpdateSchema.safeParse({ registrationId: "r1", drawEligibility: "ELIGIBLE" }).success,
    ).toBe(true);
  });

  it("rejects an unknown status value", () => {
    expect(
      participantUpdateSchema.safeParse({ registrationId: "r1", drawEligibility: "DEFINITELY" }).success,
    ).toBe(false);
  });

  it("requires a non-empty selection for a bulk action", () => {
    expect(bulkUpdateSchema.safeParse({ eventId: "e1", registrationIds: [] }).success).toBe(false);
    expect(
      bulkUpdateSchema.safeParse({ eventId: "e1", registrationIds: ["r1"], drawEligibility: "ELIGIBLE" })
        .success,
    ).toBe(true);
  });
});

describe("correctionSchema", () => {
  const goodCorrection = {
    drawId: "d1",
    winnerId: "w1",
    type: "REVOKE_WINNER",
    reason: "Winner did not take part in the activity after all",
  };

  it("accepts a substantive reason", () => {
    expect(correctionSchema.safeParse(goodCorrection).success).toBe(true);
  });

  it("rejects a token reason", () => {
    // A one-word revocation is not an audit trail.
    expect(correctionSchema.safeParse({ ...goodCorrection, reason: "oops" }).success).toBe(false);
  });

  it("rejects an unknown correction type", () => {
    expect(correctionSchema.safeParse({ ...goodCorrection, type: "DELETE" }).success).toBe(false);
  });
});

describe("claimUpdateSchema", () => {
  it("accepts the mutable claim statuses", () => {
    for (const status of ["PENDING", "NOTIFIED", "CLAIMED", "UNCLAIMED"]) {
      expect(claimUpdateSchema.safeParse({ winnerId: "w1", claimStatus: status }).success).toBe(true);
    }
  });

  it("does not allow REVOKED to be set as a claim status", () => {
    // Revocation goes through its own action so it always records a correction.
    expect(claimUpdateSchema.safeParse({ winnerId: "w1", claimStatus: "REVOKED" }).success).toBe(false);
  });
});

describe("eventSettingsSchema", () => {
  it("fills in every default for an empty object", () => {
    const settings = parseEventSettings({});
    expect(settings.requireParticipationForEligibility).toBe(true);
    expect(settings.allowMultipleWinsPerParticipant).toBe(false);
    expect(settings.publicWinnersVisible).toBe(true);
    expect(settings.claimWindowDays).toBe(14);
  });

  it("survives a corrupt stored value by falling back to defaults", () => {
    // settings is a JSON column; a bad value must not take the page down.
    const settings = parseEventSettings({ requireParticipationForEligibility: "maybe" });
    expect(settings.requireParticipationForEligibility).toBe(true);
  });

  it("survives null, a string and an array", () => {
    for (const value of [null, "oops", 42, ["a"]]) {
      expect(() => eventSettingsSchema.parse(parseEventSettings(value))).not.toThrow();
    }
  });

  it("keeps explicitly stored values", () => {
    const settings = parseEventSettings({
      requireParticipationForEligibility: false,
      claimWindowDays: 30,
      winnerDisplayMode: "NONE",
    });
    expect(settings.requireParticipationForEligibility).toBe(false);
    expect(settings.claimWindowDays).toBe(30);
    expect(settings.winnerDisplayMode).toBe("NONE");
  });

  it("rejects an unknown display mode", () => {
    expect(
      eventSettingsSchema.safeParse({ ...eventSettingsSchema.parse({}), winnerDisplayMode: "FULL" }).success,
    ).toBe(false);
  });
});
