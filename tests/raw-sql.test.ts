import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards raw SQL against a failure mode that no type checker and no linter can
 * see.
 *
 * Prisma's `$queryRaw` deserialises every returned column into a JS value.
 * Postgres functions that return `void` — advisory locks, notifications — have
 * no such representation, so Prisma throws:
 *
 *   Failed to deserialize column of type 'void'.
 *
 * That is what broke registration: `SELECT pg_advisory_xact_lock(...)` was sent
 * through `$queryRaw`, and every single submission died with HTTP 500. The lock
 * itself was fine; only the execution method was wrong. The correct call is
 * `$executeRaw`, because the statement is a side effect rather than a result set.
 *
 * These tests read the source so the mistake cannot quietly come back.
 */

/** Postgres functions whose return type is `void`. */
const VOID_RETURNING = [
  "pg_advisory_xact_lock",
  "pg_advisory_lock",
  "pg_advisory_unlock",
  "pg_try_advisory_lock",
  "pg_notify",
  "pg_cancel_backend",
  "pg_terminate_backend",
  "pg_reload_conf",
  "pg_rotate_logfile",
];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

const files = sourceFiles(join(process.cwd(), "src"));

describe("raw SQL", () => {
  it("finds the source tree (guard against a silently empty scan)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never sends a void-returning function through $queryRaw", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const fn of VOID_RETURNING) {
        // Find each `$queryRaw` tagged template and look for the function in it.
        const matches = text.matchAll(/\$queryRaw`([^`]*)`/g);
        for (const match of matches) {
          const sql = match[1] ?? "";
          if (sql.includes(fn)) {
            offenders.push(`${file.replace(process.cwd(), ".")}: $queryRaw ... ${fn}`);
          }
        }
      }
    }

    expect(
      offenders,
      `These ${VOID_RETURNING.length === 0 ? "" : "void-returning"} calls will throw ` +
        `"Failed to deserialize column of type 'void'" at runtime. Use $executeRaw:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("takes the registration entry-number lock with $executeRaw", () => {
    const service = readFileSync(
      join(process.cwd(), "src", "server", "services", "registration-service.ts"),
      "utf8",
    );
    expect(service).toContain("$executeRaw`SELECT pg_advisory_xact_lock");
    // The lock must stay inside the transaction that allocates the number.
    const txStart = service.indexOf("prisma.$transaction");
    const lock = service.indexOf("$executeRaw`SELECT pg_advisory_xact_lock");
    expect(txStart).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(txStart);
  });
});

/** Remove comments so a directive mentioned in prose is not mistaken for one. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("datetime-local handling", () => {
  it("keeps the helper out of the client boundary so server pages can call it", () => {
    // A "use client" module cannot export a function that a server component
    // calls directly: React throws and the whole page 500s. That is exactly how
    // /admin/events/[id] used to die.
    const form = readFileSync(
      join(process.cwd(), "src", "components", "admin", "event-form.tsx"),
      "utf8",
    );
    expect(form).not.toContain("toDateTimeLocalValue");

    const helper = stripComments(
      readFileSync(join(process.cwd(), "src", "lib", "datetime.ts"), "utf8"),
    );
    expect(helper).not.toMatch(/^\s*["']use client["']/m);
    expect(helper).not.toMatch(/^\s*["']server-only["']/m);
  });

  it("never feeds a full ISO string to the admin datetime-local inputs", () => {
    // `<input type="datetime-local">` silently rejects "2026-11-09T09:00:00.000Z"
    // and renders blank, which is how the create-event form lost its defaults.
    // Scoped to the admin event pages, which are the only place these three
    // values feed a datetime-local control; the public pages legitimately pass
    // full ISO strings to server actions.
    const adminEventPages = sourceFiles(join(process.cwd(), "src", "app", "admin", "events"));
    const offenders: string[] = [];
    for (const file of adminEventPages) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\b(startAt|endAt|registrationDeadline):\s*([^,\n]+)/g)) {
        const value = (match[2] ?? "").trim();
        if (value.includes(".toISOString()")) {
          offenders.push(`${file.replace(process.cwd(), ".")}: ${match[1]}: ${value}`);
        }
      }
    }
    expect(
      offenders,
      `Use toDateTimeLocalValue() instead — the input would render blank:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});