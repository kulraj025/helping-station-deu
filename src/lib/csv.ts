/**
 * CSV export helpers.
 *
 * Defaults to a *redacted* export: no e-mail addresses, no phone numbers and a
 * masked student ID. Sensitive fields are only included when an admin
 * explicitly opts in, and that choice is written to the audit log.
 */
import { maskStudentId } from "./privacy";

const NEEDS_QUOTING = /[",\n\r;]/;

/** RFC 4180 escaping, plus a guard against spreadsheet formula injection. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`; // neutralise =cmd() / +SUM() style injection
  }
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Builds a CSV string with a UTF-8 BOM so Excel reads Korean text correctly. */
export function toCsv<T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(","));
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export function csvResponseHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * A filename that is safe to embed in a Content-Disposition header.
 *
 * Everything except word characters, single dots and spaces is dropped, runs
 * of dots collapse (so `../../etc/passwd` cannot leave a `....` behind), and the
 * result is never empty — an empty `filename` leaves the browser to invent one,
 * which is a worse outcome than a plain fallback.
 */
export function safeFilename(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\.{2,}/g, ".")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();
  return cleaned || "export";
}

/** Default participant export columns (redacted). */
export const participantColumns = (includeSensitive: boolean) => {
  const base = [
    { header: "Entry number", value: (r: ParticipantExportRow) => r.entryNumber },
    { header: "Name", value: (r: ParticipantExportRow) => r.name },
    { header: "Department", value: (r: ParticipantExportRow) => r.department },
    { header: "Registration status", value: (r: ParticipantExportRow) => r.registrationStatus },
    { header: "Participation status", value: (r: ParticipantExportRow) => r.participationStatus },
    { header: "Draw eligibility", value: (r: ParticipantExportRow) => r.drawEligibility },
    { header: "Volunteer role", value: (r: ParticipantExportRow) => r.volunteerRole ?? "" },
    { header: "Registered at", value: (r: ParticipantExportRow) => r.registeredAt },
    { header: "Verified at", value: (r: ParticipantExportRow) => r.verifiedAt ?? "" },
  ];
  const studentId: CsvColumn<ParticipantExportRow> = {
    header: "Student ID",
    value: (r) => (includeSensitive ? r.studentId : maskStudentId(r.studentId)),
  };
  const email: CsvColumn<ParticipantExportRow> = {
    header: "E-mail",
    value: (r) => (includeSensitive ? r.email : ""),
  };
  const phone: CsvColumn<ParticipantExportRow> = {
    header: "Phone",
    value: (r) => (includeSensitive ? r.phone ?? "" : ""),
  };
  return [...base.slice(0, 2), studentId, base[2]!, ...base.slice(3), ...(includeSensitive ? [email, phone] : [])] as Array<
    CsvColumn<ParticipantExportRow>
  >;
};

export interface ParticipantExportRow {
  entryNumber: string;
  name: string;
  studentId: string;
  email: string;
  phone: string | null;
  department: string;
  registrationStatus: string;
  participationStatus: string;
  drawEligibility: string;
  volunteerRole: string | null;
  registeredAt: string;
  verifiedAt: string | null;
}
