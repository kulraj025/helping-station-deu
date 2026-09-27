"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { firstAdminSchema } from "@/lib/validation";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/http";
import { writeAudit, AUDIT_ACTIONS } from "@/server/services/audit";
import { createUserWithPassword } from "@/server/services/registration-service";
import type { AccountState } from "@/lib/action-state";

/**
 * First-run organiser bootstrap.
 *
 * The organiser area is unreachable without an `ADMIN` row, and the only way to
 * create one was `npm run db:seed` on a machine with a terminal. This is the
 * browser-only path: set `ADMIN_SETUP_TOKEN`, open `/setup`, and the account
 * exists.
 *
 * The ordering of the checks below is the whole design, and it is repeated even
 * though the page applies the same rules — a server action is a public
 * endpoint, so anyone can POST to it without ever loading `/setup`:
 *
 *  1. No configured token → refuse. A deployment that never set the variable
 *     has no web route to an admin account at all. This is the fail-closed case.
 *  2. Rate limited per IP, before any database work, because the token is the
 *     only real barrier and guessing must be expensive.
 *  3. Validate the body, then compare the token in constant time.
 *  4. Re-check that no admin exists, to settle two people racing each other.
 *
 * Once an admin exists the route stops rendering, so this is a one-shot door
 * rather than a permanent backdoor: a leaked token stops mattering after use.
 */

/** Whether `/setup` should exist at all. */
export async function adminSetupAvailable(): Promise<boolean> {
  if (env.adminSetupToken.length === 0) return false;
  const existing = await prisma.user.count({ where: { role: "ADMIN" } });
  return existing === 0;
}

/**
 * Constant-time token comparison.
 *
 * `timingSafeEqual` throws when the two buffers differ in length, which would
 * itself leak the secret's length through an exception. Hashing both sides
 * first makes them a fixed 32 bytes, so the comparison cannot throw and the
 * length is never observable.
 */
function tokenMatches(candidate: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createFirstAdminAction(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  // 1. Fail closed.
  if (env.adminSetupToken.length === 0) {
    return {
      status: "error",
      message:
        "First-run setup is not enabled here. Set ADMIN_SETUP_TOKEN in the environment and deploy again.",
    };
  }

  // 2. Rate limit first, so a wrong token cannot be guessed in bulk.
  const ipHash = await getClientIpHash();
  const limit = await rateLimit(
    "admin-setup",
    ipHash,
    LIMITS.adminSetup.limit,
    LIMITS.adminSetup.windowSeconds,
  );
  if (!limit.ok) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = firstAdminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    setupToken: formData.get("setupToken"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // 3. Constant-time check, after validation so a malformed body cannot be
  //    used to probe the token.
  if (!tokenMatches(parsed.data.setupToken, env.adminSetupToken)) {
    return { status: "error", message: "That setup token is not correct." };
  }

  // 4. Settle a race: two people opening `/setup` simultaneously must not both
  //    succeed. Without this the loser hits the unique index on `email` and
  //    gets an unhandled 500 instead of a sentence.
  const existingAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (existingAdmins > 0) {
    return { status: "error", message: "An organiser account already exists. Sign in instead." };
  }

  const clash = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (clash) {
    return {
      status: "error",
      message:
        clash.role === "ADMIN"
          ? "That e-mail address already has an account. Sign in instead."
          : "That e-mail address is already registered as a student, so it cannot also be an organiser.",
    };
  }

  await createUserWithPassword({
    email: parsed.data.email,
    name: parsed.data.name,
    password: parsed.data.password,
    role: "ADMIN",
  });

  await writeAudit({
    action: AUDIT_ACTIONS.adminBootstrapped,
    targetType: "User",
    metadata: { email: parsed.data.email },
    ipHash,
  });

  revalidatePath("/login");

  // `redirect` throws, so it has to be the last statement — nothing after it
  // would ever run.
  redirect("/login?setup=done");
}
