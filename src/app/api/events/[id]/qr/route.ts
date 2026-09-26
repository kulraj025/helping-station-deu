import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { resolveEvent } from "@/server/services/event-service";
import { qrPngBuffer, registerUrl } from "@/lib/qr";
import { writeAudit, AUDIT_ACTIONS } from "@/server/services/audit";
import { getClientIpHash } from "@/lib/http";

/**
 * Registration QR code as a PNG.
 *
 * Admin only: the download is written to the audit log, because a poster is a
 * published artefact.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(`/admin/events/${(await params).id}`);
  const { id } = await params;
  const event = await resolveEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const png = await qrPngBuffer(registerUrl(event.slug), 1024);
  await writeAudit({
    action: AUDIT_ACTIONS.qrDownloaded,
    eventId: event.id,
    adminId: admin.id,
    targetType: "Event",
    targetId: event.id,
    metadata: { slug: event.slug },
    ipHash: await getClientIpHash(),
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${event.slug}-qr.png"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
