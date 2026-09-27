/**
 * Server-side validation.
 *
 * Every mutation in the app runs through one of these Zod schemas. The client
 * mirrors the same rules for instant feedback, but the server copy is the one
 * that decides — the client is never trusted.
 */
import { z } from "zod";
import {
  DEPARTMENTS,
  ELIGIBILITY_STATUSES,
  EVENT_STATUSES,
  PARTICIPATION_STATUSES,
  PASSWORD_MIN_LENGTH,
  VOLUNTEER_ROLES,
} from "./constants";

/** Remove control characters, collapse whitespace, and cap the length. */
export function sanitizeText(value: string, maxLength = 500): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((value) => sanitizeText(value, max + 20))
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be ${max} characters or fewer`),
    );

const emailField = z
  .string()
  .transform((value) => sanitizeText(value, 254).toLowerCase())
  .pipe(z.email("Enter a valid e-mail address"));

const phoneField = z
  .string()
  .transform((value) => sanitizeText(value, 32))
  .pipe(
    z
      .string()
      .min(7, "Enter a valid phone number")
      .max(24, "Phone number is too long")
      .regex(/^[0-9+()\-\s]+$/, "Phone number may only contain digits, spaces, +, - and ( )"),
  );

const optionalPhone = z
  .union([z.literal(""), phoneField])
  .optional()
  .transform((value) => (value ? value : undefined));

export const ACADEMIC_DOMAIN_HINTS = [
  "ac.kr",
  "ac.jp",
  "ac.id",
  "edu",
  "edu.au",
  "edu.cn",
  "edu.sg",
  "univ",
];

export function isAcademicEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return ACADEMIC_DOMAIN_HINTS.some((hint) => domain.endsWith(hint));
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    eventId: z.string().min(1, "Missing event").max(64),
    fullName: trimmed(2, 80, "Full name"),
    email: emailField,
    studentId: z
      .string()
      .transform((value) => sanitizeText(value, 24).toUpperCase())
      .pipe(
        z
          .string()
          .min(4, "Student ID must be at least 4 characters")
          .max(24, "Student ID is too long")
          .regex(/^[A-Z0-9-]+$/, "Student ID may only contain letters, numbers and dashes"),
      ),
    department: trimmed(2, 60, "Department"),
    phone: phoneField,
    volunteerRole: z
      .union([
        z.literal(""),
        z.enum(VOLUNTEER_ROLES, { message: "Choose one of the listed volunteer roles" }),
      ])
      .optional()
      .transform((value) => (value ? value : undefined)),
    emergencyContactName: z
      .union([z.literal(""), trimmed(2, 60, "Emergency contact name")])
      .optional()
      .transform((value) => (value ? value : undefined)),
    emergencyContactPhone: optionalPhone,
    // Consent checkboxes are kept strictly separate on purpose.
    agreeRules: z.literal(true, { message: "You must accept the participation rules" }),
    dataConsent: z.literal(true, { message: "You must accept the data processing notice" }),
    drawConsent: z.boolean().default(false),
    publicDisplayConsent: z.boolean().default(false),
    contactConsent: z.boolean().default(false),
    // Anti-bot: a hidden field humans never fill in.
    website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
    // Anti-bot: when the form was rendered. Humans take longer than 1.5s.
    renderedAt: z.number().int().positive().optional(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.drawConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["drawConsent"],
        message: "The lucky draw needs your separate consent",
      });
    }
    if ((value.emergencyContactName && !value.emergencyContactPhone) || (!value.emergencyContactName && value.emergencyContactPhone)) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyContactPhone"],
        message: "Provide both the emergency contact name and number, or leave both blank",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const studentLoginSchema = z.object({
  identifier: z.string().transform((v) => sanitizeText(v, 254).toLowerCase()).pipe(z.email()),
  password: z.string().min(1, "Enter your password").max(200),
});

export const claimCodeLoginSchema = z.object({
  identifier: z.string().transform((v) => sanitizeText(v, 254).toLowerCase()).pipe(z.email()),
  claimCode: z
    .string()
    .transform((v) => sanitizeText(v, 16).toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6,16}$/, "That code does not look right")),
});

export const adminLoginSchema = z.object({
  email: z.string().transform((v) => sanitizeText(v, 254).toLowerCase()).pipe(z.email()),
  // Deliberately not `min(PASSWORD_MIN_LENGTH)`: a login form that enforces a
  // minimum rejects anyone whose password was set under an older policy, and
  // the correct response to a rejected password is a wrong-password message,
  // not a length complaint. Setting rules live in `setPasswordSchema` only.
  password: z.string().min(1, "Enter your password").max(200),
  website: z.string().max(0).optional().or(z.literal("")),
});

/**
 * First-run organiser account, created through `/setup`.
 *
 * `setupToken` is the deployment's `ADMIN_SETUP_TOKEN`. It is part of the body
 * rather than a header so it arrives with the form post, and the action
 * re-checks it server-side — never trust that the page was rendered because
 * the token was right.
 */
export const firstAdminSchema = z
  .object({
    name: z.string().transform((v) => sanitizeText(v, 80)).pipe(z.string().min(2, "Enter your name")),
    email: z
      .string()
      .transform((v) => sanitizeText(v, 254).toLowerCase())
      .pipe(z.email("Enter a valid e-mail address")),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(200),
    confirmPassword: z.string(),
    // Part of the body rather than a header, so it arrives with the form post.
    setupToken: z.string().min(1, "Enter the setup token"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// ---------------------------------------------------------------------------
// Event management
// ---------------------------------------------------------------------------

const dateField = z
  .string()
  .min(1, "Required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time");

export const eventSchema = z
  .object({
    id: z.string().optional(),
    name: trimmed(3, 120, "Event name"),
    tagline: z.union([z.literal(""), trimmed(0, 160, "Tagline")]).optional(),
    description: trimmed(20, 4000, "Description"),
    locationName: trimmed(2, 160, "Location"),
    locationAddress: z.union([z.literal(""), trimmed(0, 240, "Address")]).optional(),
    startAt: dateField,
    endAt: dateField,
    registrationDeadline: dateField,
    status: z.enum(EVENT_STATUSES),
    capacity: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(100_000)])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
    organizerName: trimmed(2, 120, "Organiser"),
    organizerDepartment: z.union([z.literal(""), trimmed(0, 120, "Department")]).optional(),
    organizerContact: z.union([z.literal(""), trimmed(0, 160, "Contact")]).optional(),
    requireParticipationForEligibility: z.boolean().default(true),
    allowMultipleWinsPerParticipant: z.boolean().default(false),
    winnerDisplayMode: z.enum(["MASKED", "NONE"]).default("MASKED"),
    publicWinnersVisible: z.boolean().default(true),
    publicDrawScreenVisible: z.boolean().default(true),
    showParticipantCount: z.boolean().default(true),
    claimWindowDays: z.coerce.number().int().min(1).max(365).default(14),
    requireDrawConsent: z.boolean().default(true),
    requireEmergencyContact: z.boolean().default(false),
    prizeClaimNote: z.union([z.literal(""), trimmed(0, 2000, "Note")]).optional(),
    winnerContactMethod: z.union([z.literal(""), trimmed(0, 500, "Contact method")]).optional(),
    complianceNote: z.union([z.literal(""), trimmed(0, 2000, "Compliance note")]).optional(),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startAt);
    const end = Date.parse(value.endAt);
    const deadline = Date.parse(value.registrationDeadline);
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "End time must be after the start time" });
    }
    if (Number.isFinite(start) && Number.isFinite(deadline) && deadline > start) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationDeadline"],
        message: "Registration must close before the event starts",
      });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;

// ---------------------------------------------------------------------------
// Prizes
// ---------------------------------------------------------------------------

export const prizeSchema = z.object({
  eventId: z.string().min(1),
  id: z.string().optional(),
  name: trimmed(2, 80, "Prize name"),
  description: z.union([z.literal(""), trimmed(0, 240, "Description")]).optional(),
  quantity: z.coerce.number().int().min(1, "At least one winner").max(500, "That is a lot of prizes"),
  claimInstructions: z.union([z.literal(""), trimmed(0, 500, "Instructions")]).optional(),
});

export const prizeReorderSchema = z.object({
  eventId: z.string().min(1),
  order: z.array(z.object({ id: z.string().min(1), order: z.coerce.number().int().min(1) })).min(1),
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export const participantUpdateSchema = z
  .object({
    registrationId: z.string().min(1),
    participationStatus: z.enum(PARTICIPATION_STATUSES).optional(),
    drawEligibility: z.enum(ELIGIBILITY_STATUSES).optional(),
    eligibilityReason: z.union([z.literal(""), trimmed(0, 240, "Reason")]).optional(),
  })
  .refine((value) => value.participationStatus !== undefined || value.drawEligibility !== undefined, {
    message: "Nothing to update",
  });

export const bulkUpdateSchema = z.object({
  eventId: z.string().min(1),
  registrationIds: z.array(z.string().min(1)).min(1, "Select at least one participant").max(500),
  participationStatus: z.enum(PARTICIPATION_STATUSES).optional(),
  drawEligibility: z.enum(ELIGIBILITY_STATUSES).optional(),
});

export const correctionSchema = z.object({
  drawId: z.string().min(1),
  winnerId: z.string().min(1),
  type: z.enum(["REVOKE_WINNER", "ANNOTATE"]),
  reason: trimmed(10, 500, "Reason"),
  details: z.union([z.literal(""), trimmed(0, 1000, "Details")]).optional(),
});

export const claimUpdateSchema = z.object({
  winnerId: z.string().min(1),
  claimStatus: z.enum(["PENDING", "NOTIFIED", "CLAIMED", "UNCLAIMED"]),
});

export const exportQuerySchema = z.object({
  eventId: z.string().min(1),
  format: z.enum(["csv", "json"]).default("csv"),
  scope: z.enum(["participants", "winners", "audit", "draw-report"]).default("participants"),
  includeSensitive: z.enum(["0", "1"]).default("0"),
});

export const DEPARTMENT_SUGGESTIONS = DEPARTMENTS;
