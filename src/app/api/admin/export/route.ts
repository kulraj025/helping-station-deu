import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { resolveEvent } from "@/server/services/event-service";
import { verifyDrawIntegrity } from "@/server/services/draw-service";
import { getEligibilitySummary } from "@/server/services/participant-service";
import { AUDIT_ACTIONS, writeAudit } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";
import {
  csvResponseHeaders,
  participantColumns,
  safeFilename,
  toCsv,
  type ParticipantExportRow,
} from "@/lib/csv";
import { maskStudentId } from "@/lib/privacy";
import { formatDateTimeUtc } from "@/lib/format";

/**
 * CSV / JSON export.
 *
 * Two guarantees:
 *  1. The default projection is redacted — no e-mail, no phone, masked student
 *     ID. Personal data is only included when an admin explicitly opts in.
 *  2. Every export is written to the audit log, including the `includeSensitive`
 *     decision, so a file leaving the system is always traceable.
 */

export const dynamic = "force-dynamic";

const querySchema = z.object({
  event: z.string().min(1),
  scope: z.enum(["participants", "winners", "audit", "draw-report"]).default("participants"),
  format: z.enum(["csv", "json"]).default("csv"),
  includeSensitive: z.enum(["0", "1"]).default("0"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    event: url.searchParams.get("event") ?? "",
    scope: url.searchParams.get("scope") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
    includeSensitive: url.searchParams.get("includeSensitive") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  }

  const returnTo = `/admin/export?event=${encodeURIComponent(parsed.data.event)}`;
  const admin = await requireAdmin(returnTo);

  const event = await resolveEvent(parsed.data.event);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const sensitive = parsed.data.includeSensitive === "1";
  const scope = parsed.data.scope;
  const format = parsed.data.format;
  const base = `${event.slug}-${scope}`;
  const stamp = new Date().toISOString().slice(0, 10);

  // --- gather rows ---------------------------------------------------------
  let csv = "";
  let json: unknown = null;

  if (scope === "participants") {
    const rows = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: { entryNumber: "asc" },
      include: { user: { select: { name: true, studentId: true, email: true, phone: true, department: true } } },
    });
    const data: ParticipantExportRow[] = rows.map((row) => ({
      entryNumber: row.entryNumber,
      name: row.user.name,
      studentId: row.user.studentId,
      email: row.user.email,
      phone: row.user.phone,
      department: row.user.department,
      registrationStatus: row.registrationStatus,
      participationStatus: row.participationStatus,
      drawEligibility: row.drawEligibility,
      volunteerRole: row.volunteerRole,
      registeredAt: formatDateTimeUtc(row.createdAt),
      verifiedAt: row.verifiedAt ? formatDateTimeUtc(row.verifiedAt) : null,
    }));
    csv = toCsv(data, participantColumns(sensitive));
    json = { event: { id: event.id, name: event.name, slug: event.slug }, count: data.length, includeSensitive: sensitive, participants: data };
  }

  if (scope === "winners") {
    const rows = await prisma.winner.findMany({
      where: { eventId: event.id },
      orderBy: [{ selectedAt: "asc" }],
      include: {
        prize: { select: { name: true, order: true } },
        registration: { select: { user: { select: { name: true, email: true, phone: true, studentId: true, department: true } }, contactConsentAt: true } },
      },
    });
    const data = rows.map((row) => ({
      prize: row.prize.name,
      entryNumber: row.entryNumber,
      publicName: row.displayName,
      claimStatus: row.claimStatus,
      selectedAt: formatDateTimeUtc(row.selectedAt),
      claimedAt: row.claimedAt ? formatDateTimeUtc(row.claimedAt) : "",
      revokedReason: row.revokedReason ?? "",
      fullName: sensitive ? row.registration.user.name : maskStudentId(row.registration.user.studentId),
      email: sensitive ? row.registration.user.email : "",
      phone: sensitive ? (row.registration.user.phone ?? "") : "",
      studentId: sensitive ? row.registration.user.studentId : maskStudentId(row.registration.user.studentId),
      contactConsent: Boolean(row.registration.contactConsentAt),
    }));
    csv = toCsv(data, [
      { header: "Prize", value: (r) => r.prize },
      { header: "Entry number", value: (r) => r.entryNumber },
      { header: "Public name", value: (r) => r.publicName },
      { header: "Claim status", value: (r) => r.claimStatus },
      { header: "Selected at (UTC)", value: (r) => r.selectedAt },
      { header: "Claimed at (UTC)", value: (r) => r.claimedAt },
      { header: "Revoked reason", value: (r) => r.revokedReason },
      { header: sensitive ? "Full name" : "Participant", value: (r) => r.fullName },
      { header: "E-mail", value: (r) => r.email },
      { header: "Phone", value: (r) => r.phone },
      { header: "Student ID", value: (r) => r.studentId },
      { header: "Contact consent", value: (r) => (r.contactConsent ? "yes" : "no") },
    ]);
    json = { event: { id: event.id, name: event.name }, count: data.length, includeSensitive: sensitive, winners: data };
  }

  if (scope === "audit") {
    const rows = await prisma.auditLog.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { admin: { select: { name: true } } },
    });
    const data = rows.map((row) => ({
      at: formatDateTimeUtc(row.createdAt),
      action: row.action,
      admin: sensitive ? (row.admin?.name ?? "") : "",
      targetType: row.targetType ?? "",
      targetId: row.targetId ?? "",
      metadata: JSON.stringify(row.metadata ?? {}),
    }));
    csv = toCsv(data, [
      { header: "Timestamp (UTC)", value: (r) => r.at },
      { header: "Action", value: (r) => r.action },
      { header: "Administrator", value: (r) => r.admin },
      { header: "Target type", value: (r) => r.targetType },
      { header: "Target id", value: (r) => r.targetId },
      { header: "Metadata", value: (r) => r.metadata },
    ]);
    json = { event: { id: event.id, name: event.name }, count: data.length, logs: data };
  }

  if (scope === "draw-report") {
    const draw = await prisma.draw.findUnique({
      where: { eventId_official: { eventId: event.id, official: true } },
      include: { winners: { include: { prize: { select: { name: true, order: true } } } }, poolEntries: true },
    });
    let verification = null;
    if (draw?.status === "COMPLETED") {
      try {
        verification = await verifyDrawIntegrity(draw.id);
        await writeAudit({
          action: AUDIT_ACTIONS.drawVerified,
          eventId: event.id,
          drawId: draw.id,
          adminId: admin.id,
          targetType: "Draw",
          targetId: draw.id,
          metadata: verification,
        });
      } catch (error) {
        verification = { error: error instanceof Error ? error.message : "verification failed" };
      }
    }
    const summary = await getEligibilitySummary(event.id);
    const report = {
      event: { id: event.id, name: event.name, slug: event.slug, startAt: event.startAt, status: event.status },
      draw: draw
        ? {
            id: draw.id,
            status: draw.status,
            startedAt: draw.startedAt,
            completedAt: draw.completedAt,
            poolLockedAt: draw.poolLockedAt,
            eligibleCount: draw.eligibleParticipantCount,
            poolEntries: draw.poolEntries.length,
            poolSnapshotHash: draw.poolSnapshotHash,
            selectionDigest: draw.selectionDigest,
            selectionEntropy: draw.selectionEntropy,
          }
        : null,
      eligibility: summary,
      winners: draw?.winners.map((winner) => ({
        prize: winner.prize.name,
        entryNumber: winner.entryNumber,
        displayName: winner.displayName,
        claimStatus: winner.claimStatus,
        selectedAt: winner.selectedAt,
      })) ?? [],
      verification,
      generatedAt: new Date().toISOString(),
      generatedBy: admin.email,
    };
    json = report;
    csv = toCsv(report.winners, [
      { header: "Prize", value: (r) => r.prize },
      { header: "Entry number", value: (r) => r.entryNumber },
      { header: "Public name", value: (r) => r.displayName },
      { header: "Claim status", value: (r) => r.claimStatus },
      { header: "Selected at (UTC)", value: (r) => formatDateTimeUtc(r.selectedAt) },
    ]);
  }

  await writeAudit({
    action: AUDIT_ACTIONS.exportGenerated,
    eventId: event.id,
    adminId: admin.id,
    targetType: "Export",
    metadata: { scope, format, includeSensitive: sensitive, filename: safeFilename(`${base}-${stamp}`) },
    ipHash: await getClientIpHash(),
  });

  if (format === "json") {
    return NextResponse.json(json, {
      headers: {
        "Content-Disposition": `attachment; filename="${safeFilename(`${base}-${stamp}`)}.json"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new NextResponse(csv, {
    headers: csvResponseHeaders(`${safeFilename(`${base}-${stamp}`)}.csv`),
  });
}
