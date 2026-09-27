import { createHash, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firstAdminSchema, setPasswordSchema } from "@/lib/validation";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

/**
 * Password policy.
 *
 * These assert the *shape* of the rule rather than restating it, so changing
 * `PASSWORD_MIN_LENGTH` cannot leave a test quietly asserting the old number.
 */
describe("password policy", () => {
  it("is length-only: no composition requirement", () => {
    // Every one of these would have failed the old policy, which demanded an
    // upper-case letter, a lower-case letter and a digit.
    const nowAcceptable = [
      "abcdef",
      "lowercase",
      "UPPERCASE",
      "1234567",
      "!@#$%^&",
      "a", // length is what matters, and this is below the minimum
    ];
    for (const password of nowAcceptable) {
      const result = setPasswordSchema.safeParse({ password, confirmPassword: password });
      expect(result.success, `"${password}" (${password.length} chars)`).toBe(password.length >= PASSWORD_MIN_LENGTH);
    }
  });

  it("rejects anything under the minimum", () => {
    for (let length = 1; length < PASSWORD_MIN_LENGTH; length++) {
      const password = "a".repeat(length);
      expect(
        setPasswordSchema.safeParse({ password, confirmPassword: password }).success,
        `${length} characters should be rejected`,
      ).toBe(false);
    }
  });

  it("accepts exactly the minimum", () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH);
    expect(setPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(true);
  });

  it("still rejects a mismatched confirmation", () => {
    const password = "correcthorse";
    expect(
      setPasswordSchema.safeParse({ password, confirmPassword: "correcthorseX" }).success,
    ).toBe(false);
  });

  it("is actually reachable from the real schema, not just in isolation", () => {
    // Guards against the policy constant and the schema drifting apart: if
    // `setPasswordSchema` were still hardcoded to 10, this fails.
    const exactlyMin = "a".repeat(PASSWORD_MIN_LENGTH);
    expect(setPasswordSchema.safeParse({ password: exactlyMin, confirmPassword: exactlyMin }).success).toBe(true);

    const oneBelow = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(setPasswordSchema.safeParse({ password: oneBelow, confirmPassword: oneBelow }).success).toBe(false);
  });
});

/**
 * First-run setup.
 *
 * The token comparison is duplicated here rather than imported, because it
 * lives inside a `"use server"` module and cannot be imported into a test. The
 * copy is byte-identical to the one in `src/server/actions/setup-actions.ts`.
 */
function tokenMatches(candidate: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

describe("first-admin setup token", () => {
  const SECRET = "correct-horse-battery-staple";

  it("accepts the exact token", () => {
    expect(tokenMatches(SECRET, SECRET)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(tokenMatches("wrong", SECRET)).toBe(false);
    // Prefix and extension must not pass, or the check would be a `startsWith`.
    expect(tokenMatches(SECRET.slice(0, 10), SECRET)).toBe(false);
    expect(tokenMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(tokenMatches("", SECRET)).toBe(false);
  });

  it("fails closed when no token is configured", () => {
    // Empty expected value must reject every candidate, including empty. This
    // is the case that keeps a deployment with no ADMIN_SETUP_TOKEN from
    // having a working setup route.
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches("anything", "")).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    // `timingSafeEqual` throws on different lengths, which would turn the
    // secret's length into an observable signal. Hashing first avoids it.
    expect(() => tokenMatches("a", SECRET)).not.toThrow();
    expect(() => tokenMatches(SECRET, "a")).not.toThrow();
  });
});

describe("firstAdminSchema", () => {
  const valid = {
    name: "Kulraj",
    email: "kulraj024@gmail.com",
    password: "abcdef",
    confirmPassword: "abcdef",
    setupToken: "some-token",
  };

  it("accepts a well-formed signup", () => {
    const result = firstAdminSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("kulraj024@gmail.com");
    }
  });

  it("lowercases the e-mail so it matches the login lookup", () => {
    const result = firstAdminSchema.safeParse({ ...valid, email: "  Kulraj024@Gmail.COM  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("kulraj024@gmail.com");
  });

  it("requires a token", () => {
    const result = firstAdminSchema.safeParse({ ...valid, setupToken: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a mismatched confirmation", () => {
    const result = firstAdminSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("rejects a short password", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const result = firstAdminSchema.safeParse({
      ...valid,
      password: short,
      confirmPassword: short,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid e-mail", () => {
    expect(firstAdminSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});
