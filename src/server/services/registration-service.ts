import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { hashIdentifier, rateLimit, LIMITS } from "@/lib/rate-limit";
import { nextEntryNumber } from "@/lib/entry-number";
import { isAcademicEmail, type RegisterInput } from "@/lib/validation";
import { isRegistrationOpen, resolveEvent, type EventWithSettings } from "./event-service";
import { AUDIT_ACTIONS, writeAudit } from "./audit";

const BCRYPT_ROUNDS = 10;
/** Unambiguous alphabet so codes can be read aloud and typed from a phone. */
const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateClaimCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CLAIM_ALPHABET[(bytes[i] as number) % CLAIM_ALPHABET.length];
  }
  return out;
}

export type RegisterResult =
  | {
      status: "SUCCESS";
      registrationId: string;
      entryNumber: string;
      claimCode: string | null;
      event: { id: string; name: string; slug: string; startAt: Date; endAt: Date; locationName: string };
      isDemo: boolean;
      isAcademicEmail: boolean;
    }
  | { status: "DUPLICATE"; entryNumber: string; revealed: boolean; canReveal: boolean }
  | { status: "EVENT_CLOSED" }
  | { status: "EVENT_FULL"; capacity: number }
  | { status: "NOT_FOUND" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "REJECTED" };

export interface RegisterContext {
  ipHash: string;
  userAgent?: string;
  /** Password typed by a returning student, used only to confirm identity. */
  password?: string;
  turnstileVerified?: boolean;
}

/**
 * Create a registration.
 *
 * Guarantees:
 *  - one registration per student per event (`@@unique([userId, eventId])`),
 *  - a unique entry number per event, allocated under a Postgres advisory lock
 *    so two phones registering at the same instant cannot collide,
 *  - a duplicate attempt never leaks the claim code to a third party.
 */
export async function registerStudent(
  input: RegisterInput,
  context: RegisterContext,
): Promise<RegisterResult> {
  const event = await resolveEvent(input.eventId);
  if (!event) return { status: "NOT_FOUND" };

  const isDemo = env.demoMode;

  // --- abuse controls ------------------------------------------------------
  const ipLimit = await rateLimit(
    LIMITS.register.key,
    context.ipHash,
    LIMITS.register.limit,
    LIMITS.register.windowSeconds,
  );
  if (!ipLimit.ok) {
    return { status: "RATE_LIMITED", retryAfterSeconds: ipLimit.retryAfterSeconds ?? 600 };
  }
  const emailLimit = await rateLimit(
    LIMITS.registerEmail.key,
    hashIdentifier(input.email),
    LIMITS.registerEmail.limit,
    LIMITS.registerEmail.windowSeconds,
  );
  if (!emailLimit.ok) {
    return { status: "RATE_LIMITED", retryAfterSeconds: emailLimit.retryAfterSeconds ?? 3600 };
  }
  if (input.website) return { status: "REJECTED" };
  if (
    input.renderedAt &&
    Date.now() - input.renderedAt < 1200 // typed impossibly fast
  ) {
    return { status: "REJECTED" };
  }
  if (context.turnstileVerified === false) return { status: "REJECTED" };

  // --- event window --------------------------------------------------------
  if (!isRegistrationOpen(event)) return { status: "EVENT_CLOSED" };

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // Serialise entry-number allocation per event.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${event.id}))`;

    const existingUser = await tx.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const existingRegistration = await tx.registration.findUnique({
        where: { userId_eventId: { userId: existingUser.id, eventId: event.id } },
        include: { user: { select: { passwordHash: true, claimCodeHash: true } } },
      });
      if (existingRegistration) {
        // Only reveal the entry number if the person can prove they own the
        // account. Otherwise point them at the sign-in flow.
        const revealed = Boolean(
          context.password &&
            existingRegistration.user.passwordHash &&
            (await bcrypt.compare(context.password, existingRegistration.user.passwordHash)),
        );
        await writeAudit({
          action: AUDIT_ACTIONS.registrationDuplicate,
          eventId: event.id,
          targetType: "Registration",
          targetId: existingRegistration.id,
          metadata: { entryNumber: existingRegistration.entryNumber, revealed },
          ipHash: context.ipHash,
        });
        return {
          status: "DUPLICATE" as const,
          entryNumber: existingRegistration.entryNumber,
          revealed,
          canReveal: revealed || existingRegistration.user.claimCodeHash === null,
        };
      }
    }

    // --- capacity ----------------------------------------------------------
    if (event.capacity) {
      const count = await tx.registration.count({
        where: { eventId: event.id, registrationStatus: "CONFIRMED" },
      });
      if (count >= event.capacity) {
        return { status: "EVENT_FULL" as const, capacity: event.capacity };
      }
    }

    // --- identity ----------------------------------------------------------
    let userId = existingUser?.id;
    let claimCode: string | null = null;
    let passwordHash: string | undefined;
    if (context.password) {
      passwordHash = await bcrypt.hash(context.password, BCRYPT_ROUNDS);
    }

    if (existingUser) {
      // Same student, new event: refresh contact details, never touch the
      // existing password hash.
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.fullName,
          studentId: input.studentId,
          department: input.department,
          phone: input.phone,
          ...(passwordHash && !existingUser.passwordHash ? { passwordHash } : {}),
        },
      });
    } else {
      if (!passwordHash) claimCode = generateClaimCode();
      const created = await tx.user.create({
        data: {
          email: input.email,
          name: input.fullName,
          studentId: input.studentId,
          department: input.department,
          phone: input.phone,
          role: "STUDENT",
          passwordHash: passwordHash ?? null,
          claimCodeHash: claimCode ? await bcrypt.hash(claimCode, BCRYPT_ROUNDS) : null,
          isDemo,
        },
        select: { id: true },
      });
      userId = created.id;
    }

    // --- entry number ------------------------------------------------------
    const usedNumbers = await tx.registration.findMany({
      where: { eventId: event.id },
      select: { entryNumber: true },
    });
    const entryNumber = nextEntryNumber(
      usedNumbers.map((row) => row.entryNumber),
      isDemo,
    );

    const registration = await tx.registration.create({
      data: {
        eventId: event.id,
        userId: userId as string,
        entryNumber,
        registrationStatus: "CONFIRMED",
        participationStatus: "REGISTERED",
        drawEligibility: "PENDING",
        volunteerRole: input.volunteerRole ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        rulesAcceptedAt: now,
        dataConsentAt: now,
        drawConsentAt: input.drawConsent ? now : null,
        publicDisplayConsent: input.publicDisplayConsent,
        contactConsentAt: input.contactConsent ? now : null,
        ipHash: context.ipHash,
        isDemo,
      },
      select: { id: true, entryNumber: true },
    });

    return {
      status: "SUCCESS" as const,
      registrationId: registration.id,
      entryNumber: registration.entryNumber,
      claimCode,
      isDemo,
      isAcademicEmail: isAcademicEmail(input.email),
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        startAt: event.startAt,
        endAt: event.endAt,
        locationName: event.locationName,
      },
    };
  }).then(async (result) => {
    if (result.status === "SUCCESS") {
      await writeAudit({
        action: AUDIT_ACTIONS.registrationCreated,
        eventId: result.event.id,
        targetType: "Registration",
        targetId: result.registrationId,
        metadata: { entryNumber: result.entryNumber, isDemo: result.isDemo },
        ipHash: context.ipHash,
      });
    }
    return result;
  });
}

/** Every registration belonging to a student, newest first. */
export async function getRegistrationsForUser(userId: string) {
  return prisma.registration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          startAt: true,
          endAt: true,
          locationName: true,
          organizerName: true,
          organizerContact: true,
          settings: true,
          isDemo: true,
        },
      },
      // A student may always see their own prizes, revoked or not — the history
      // is part of the record they are entitled to.
      winners: {
        where: { claimStatus: { not: "REVOKED" } },
        select: { id: true, claimStatus: true, selectedAt: true, prize: { select: { name: true } } },
        orderBy: { selectedAt: "asc" },
      },
    },
  });
}

export async function getRegistrationForEvent(userId: string, eventId: string) {
  return prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
    include: {
      event: { select: { id: true, name: true, slug: true, startAt: true, endAt: true, locationName: true, settings: true } },
      winners: {
        where: { claimStatus: { not: "REVOKED" } },
        select: { id: true, prize: { select: { name: true, description: true } }, selectedAt: true },
        orderBy: { selectedAt: "asc" },
      },
    },
  });
}

/** Recover a registration with the one-time claim code (first sign-in). */
export async function consumeClaimCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.claimCodeHash) return false;
  const ok = await bcrypt.compare(code.toUpperCase(), user.claimCodeHash);
  if (!ok) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { claimCodeHash: null, claimCodeUsedAt: new Date() },
  });
  return true;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), claimCodeHash: null },
  });
}

export type { EventWithSettings };
