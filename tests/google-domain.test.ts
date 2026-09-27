import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The allow-list check gates who may create an account, so it is tested against
 * the real export rather than a copy. `src/lib/env.ts` reads `process.env` at
 * module load, so the cases that vary the variable re-import it with
 * `vi.resetModules()`.
 */
async function loadCheck(rawDomain: string | undefined) {
  if (rawDomain === undefined) delete process.env.GOOGLE_ALLOWED_DOMAIN;
  else process.env.GOOGLE_ALLOWED_DOMAIN = rawDomain;
  vi.resetModules();
  const mod = await import("@/lib/env");
  return { allowed: mod.isEmailDomainAllowed, domain: mod.env.googleAllowedDomain };
}

describe("Google sign-in domain allow-list", () => {
  const original = process.env.GOOGLE_ALLOWED_DOMAIN;
  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_ALLOWED_DOMAIN;
    else process.env.GOOGLE_ALLOWED_DOMAIN = original;
  });

  it("normalises the configured domain", async () => {
    expect((await loadCheck("deu.ac.kr")).domain).toBe("@deu.ac.kr");
    expect((await loadCheck("@deu.ac.kr")).domain).toBe("@deu.ac.kr");
    expect((await loadCheck("  DEU.AC.KR  ")).domain).toBe("@deu.ac.kr");
    expect((await loadCheck("")).domain).toBe("");
    expect((await loadCheck("   ")).domain).toBe("");
    expect((await loadCheck(undefined)).domain).toBe("");
  });

  it("allows any address when no domain is configured", async () => {
    // The deployed default: the site is open to any Google account.
    const { allowed } = await loadCheck("");
    expect(allowed("someone@gmail.com")).toBe(true);
    expect(allowed("student@deu.ac.kr")).toBe(true);
  });

  it("allows only the configured domain when one is set", async () => {
    const { allowed } = await loadCheck("deu.ac.kr");
    expect(allowed("minseok@deu.ac.kr")).toBe(true);
    expect(allowed("Minseok@DEU.ac.KR")).toBe(true);
    expect(allowed("someone@gmail.com")).toBe(false);
  });

  it("does not accept a lookalike domain", async () => {
    // A bare suffix check on the address alone would let these through.
    const { allowed } = await loadCheck("deu.ac.kr");
    expect(allowed("x@evil-deu.ac.kr")).toBe(false);
    expect(allowed("x@deu.ac.kr.evil.com")).toBe(false);
    expect(allowed("x@notdeu.ac.kr")).toBe(false);
  });
});
