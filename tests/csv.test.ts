import { describe, expect, it } from "vitest";
import {
  csvResponseHeaders,
  escapeCsvValue,
  participantColumns,
  safeFilename,
  toCsv,
  type ParticipantExportRow,
} from "@/lib/csv";
import { maskStudentId } from "@/lib/privacy";

const row: ParticipantExportRow = {
  entryNumber: "HS-0001",
  name: "Minseok Kim",
  studentId: "20231234",
  email: "minseok@deu.ac.kr",
  phone: "010-1234-5678",
  department: "Computer Science",
  registrationStatus: "CONFIRMED",
  participationStatus: "PARTICIPATED",
  drawEligibility: "ELIGIBLE",
  volunteerRole: "Setup team",
  registeredAt: "2026-05-01T09:00:00.000Z",
  verifiedAt: "2026-05-12T09:00:00.000Z",
};

describe("escapeCsvValue", () => {
  it("passes plain text through unchanged", () => {
    expect(escapeCsvValue("Minseok Kim")).toBe("Minseok Kim");
  });

  it("renders null and undefined as empty cells", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("quotes values containing a comma, quote or newline", () => {
    expect(escapeCsvValue("Kim, Minseok")).toBe('"Kim, Minseok"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("doubles embedded quotes per RFC 4180", () => {
    expect(escapeCsvValue('a"b"c')).toBe('"a""b""c"');
  });

  it("neutralises spreadsheet formula injection", () => {
    // A participant-supplied department or name must never become a macro.
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+SUM(A1:A9)")).toBe("'+SUM(A1:A9)");
    expect(escapeCsvValue("-2+3")).toBe("'-2+3");
    expect(escapeCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("still quotes an injected formula that also needs it", () => {
    expect(escapeCsvValue('=cmd,"/c calc"!A1')).toBe('"\'=cmd,""/c calc""!A1"');
  });

  it("normalises CRLF to LF inside a quoted cell", () => {
    expect(escapeCsvValue("a\r\nb")).toBe('"a\nb"');
  });
});

describe("toCsv", () => {
  const columns = [
    { header: "Entry", value: (r: ParticipantExportRow) => r.entryNumber },
    { header: "Name", value: (r: ParticipantExportRow) => r.name },
  ];

  it("starts with a UTF-8 BOM so Excel reads Korean correctly", () => {
    expect(toCsv([row], columns).charCodeAt(0)).toBe(0xfeff);
  });

  it("emits CRLF line endings and a trailing newline", () => {
    const csv = toCsv([row], columns);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("Entry,Name");
    expect(lines[1]).toBe("HS-0001,Minseok Kim");
    expect(lines[2]).toBe("");
  });

  it("emits only the header when there are no rows", () => {
    const csv = toCsv([], columns);
    expect(csv).toBe("\uFEFFEntry,Name\r\n");
  });

  it("keeps a comma inside a name inside its own cell", () => {
    const csv = toCsv([{ ...row, name: "Kim, Minseok" }], columns);
    expect(csv).toContain('"Kim, Minseok"');
  });
});

describe("participantColumns", () => {
  it("redacts contact details by default", () => {
    const headers = participantColumns(false).map((column) => column.header);
    expect(headers).not.toContain("E-mail");
    expect(headers).not.toContain("Phone");
    // The column stays, but the value is masked — a check-in desk still works.
    expect(headers).toContain("Student ID");

    const csv = toCsv([row], participantColumns(false));
    expect(csv).toContain(maskStudentId(row.studentId));
    expect(csv).not.toContain(row.email);
    expect(csv).not.toContain("5678");
  });

  it("includes contact details only when explicitly requested", () => {
    const headers = participantColumns(true).map((column) => column.header);
    expect(headers).toContain("E-mail");
    expect(headers).toContain("Phone");

    const csv = toCsv([row], participantColumns(true));
    expect(csv).toContain(row.email);
    expect(csv).toContain("010-1234-5678");
    expect(csv).toContain(row.studentId);
  });

  it("keeps the same column order in both modes so a script can rely on it", () => {
    const redacted = participantColumns(false).map((column) => column.header);
    const full = participantColumns(true).map((column) => column.header);
    expect(redacted).toEqual(full.slice(0, redacted.length));
  });
});

describe("safeFilename", () => {
  it("produces a lower-case, dash-separated name", () => {
    expect(safeFilename("Helping Station DEU — Spring Edition")).toBe(
      "helping-station-deu-spring-edition",
    );
  });

  it("strips path separators and other unsafe characters", () => {
    expect(safeFilename("../../etc/passwd")).toBe("etcpasswd");
    expect(safeFilename('a"b;c')).toBe("abc");
  });

  it("caps the length", () => {
    expect(safeFilename("x".repeat(500)).length).toBeLessThanOrEqual(80);
  });

  it("is never empty for a hostile input", () => {
    // An empty Content-Disposition filename leaves the browser to guess.
    expect(safeFilename("///")).toBe("export");
    expect(safeFilename("")).toBe("export");
    expect(safeFilename("   ")).toBe("export");
  });

  it("does not leave a leading or trailing dot", () => {
    expect(safeFilename(".hidden.")).toBe("hidden");
  });
});

describe("csvResponseHeaders", () => {
  it("is a non-caching attachment with a safe filename", () => {
    const headers = csvResponseHeaders('evil"; drop.csv');
    expect(headers["Content-Type"]).toContain("text/csv");
    expect(headers["Content-Disposition"]).toContain("attachment");
    expect(headers["Content-Disposition"]).not.toContain('";"');
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
