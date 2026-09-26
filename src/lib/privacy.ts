/**
 * Privacy helpers.
 *
 * Nothing in this module ever returns a full email address, phone number or
 * student ID to a public page. Public surfaces only ever see:
 *   - the entry number,
 *   - a masked display name (and only when the participant consented),
 *   - a department.
 */

export const MASK = "***";

/**
 * "Minseok Kim"      -> "Min*** K"
 * "김민석"            -> "김*"
 * "Min"              -> "M***"
 * "Minjun Park Jr"   -> "Min*** J"
 */
export function maskName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Participant";

  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    const only = parts[0] ?? "";
    if (only.length <= 1) return `${only}${MASK}`;
    // Latin single name: keep first two letters. CJK single name: keep outer glyphs.
    if (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(only)) {
      return `${only.slice(0, 1)}${MASK}${only.slice(-1)}`;
    }
    return `${only.slice(0, 2)}${MASK}`;
  }

  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";

  const maskFirst = (value: string): string => {
    if (value.length <= 1) return `${value}${MASK}`;
    if (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(value)) {
      return `${value.slice(0, 1)}${MASK}`;
    }
    return `${value.slice(0, 3)}${MASK}`;
  };

  const lastInitial = (value: string): string => {
    if (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(value)) return value.slice(0, 1);
    return value.slice(0, 1).toUpperCase();
  };

  return `${maskFirst(first)} ${lastInitial(last)}`;
}

/** "20231234" -> "****1234"  (keeps the last 4 characters only) */
export function maskStudentId(studentId: string): string {
  const value = studentId.trim();
  if (value.length <= 4) return MASK;
  return `${MASK}${value.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return MASK;
  const head = local.slice(0, 1);
  return `${head}${MASK}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return MASK;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/** Short, human friendly initials for avatars: "Minseok Kim" -> "MK" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HS";
  if (parts.length === 1) return (parts[0] ?? "HS").slice(0, 2).toUpperCase();
  return `${(parts[0] ?? "H").slice(0, 1)}${(parts[parts.length - 1] ?? "S").slice(0, 1)}`.toUpperCase();
}

/**
 * Decide what a public surface may show about a winner.
 * Returns `null` when nothing may be displayed.
 */
export function publicWinnerLabel(options: {
  displayName: string;
  displayMode: "MASKED" | "NONE";
  consented: boolean;
}): string | null {
  if (options.displayMode === "NONE") return null;
  if (!options.consented) return null;
  return maskName(options.displayName);
}
