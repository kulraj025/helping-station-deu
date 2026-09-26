"use server";

import { registerSchema } from "@/lib/validation";
import { registerStudent } from "@/server/services/registration-service";
import { getClientIpHash, getUserAgent } from "@/lib/http";
import { isTurnstileEnabled } from "@/lib/env";
import type { RegisterState } from "@/lib/action-state";

/**
 * Public registration action.
 *
 * The form posts here, the Zod schema decides (never the client), and the
 * service applies rate limits, honeypot/timing checks, the duplicate guard and
 * the transactional entry-number allocation.
 */

function flatten(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  return error.flatten().fieldErrors;
}

export async function registerAction(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    department: String(formData.get("department") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    volunteerRole: String(formData.get("volunteerRole") ?? ""),
    emergencyContactName: String(formData.get("emergencyContactName") ?? ""),
    emergencyContactPhone: String(formData.get("emergencyContactPhone") ?? ""),
    agreeRules: formData.get("agreeRules") === "on" || formData.get("agreeRules") === "true",
    dataConsent: formData.get("dataConsent") === "on" || formData.get("dataConsent") === "true",
    drawConsent: formData.get("drawConsent") === "on" || formData.get("drawConsent") === "true",
    publicDisplayConsent:
      formData.get("publicDisplayConsent") === "on" || formData.get("publicDisplayConsent") === "true",
    contactConsent: formData.get("contactConsent") === "on" || formData.get("contactConsent") === "true",
    website: String(formData.get("website") ?? ""),
    renderedAt: Number(formData.get("renderedAt") ?? 0) || undefined,
    turnstileToken: String(formData.get("turnstileToken") ?? "") || undefined,
  };

  // Echo back what was typed (never the checkboxes' sensitive parts) so the
  // form does not have to be retyped after a validation error.
  const values: Record<string, string> = {
    fullName: raw.fullName,
    email: raw.email,
    studentId: raw.studentId,
    department: raw.department,
    phone: raw.phone,
    volunteerRole: raw.volunteerRole,
    emergencyContactName: raw.emergencyContactName,
    emergencyContactPhone: raw.emergencyContactPhone,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields and try again.",
      fieldErrors: flatten(parsed.error),
      values,
    };
  }

  const ipHash = await getClientIpHash();
  const userAgent = await getUserAgent();

  const result = await registerStudent(parsed.data, {
    ipHash,
    userAgent,
    // Only forwarded to the service when Turnstile is actually configured;
    // `undefined` means "not required" and `false` means "failed".
    turnstileVerified: isTurnstileEnabled() ? Boolean(raw.turnstileToken) : undefined,
  });

  switch (result.status) {
    case "SUCCESS":
      return {
        status: "success",
        entryNumber: result.entryNumber,
        claimCode: result.claimCode,
        eventName: result.event.name,
        eventSlug: result.event.slug,
        message: result.isDemo
          ? "Demo registration recorded. In demo mode this entry number is fictional."
          : undefined,
      };

    case "DUPLICATE":
      return {
        status: "error",
        message: result.revealed
          ? `You are already registered with entry number ${result.entryNumber}. One registration per student, per event.`
          : "This e-mail address is already registered for this event. Sign in with your password or the claim code you received to see your entry number.",
        values,
      };

    case "EVENT_CLOSED":
      return {
        status: "error",
        message: "Registration for this event has closed. Keep an eye on the site for the next edition.",
        values,
      };

    case "EVENT_FULL":
      return {
        status: "error",
        message: `This event is full (${result.capacity} places). Please come to the next edition.`,
        values,
      };

    case "NOT_FOUND":
      return { status: "error", message: "That event could not be found.", values };

    case "RATE_LIMITED":
      return {
        status: "error",
        message: `Too many attempts. Please try again in ${Math.ceil(result.retryAfterSeconds / 60)} minute(s).`,
        values,
        retryAfterSeconds: result.retryAfterSeconds,
      };

    case "REJECTED":
    default:
      return {
        status: "error",
        message: "Your submission looked automated and was not accepted. Please try again.",
        values,
        showCaptcha: true,
      };
  }
}
