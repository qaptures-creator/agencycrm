import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only. Same as enquiry-webhook-check, re-added to
 * verify the latest test submission independently of Railway's laggy log
 * feed. No writes, no message bodies, no raw email/phone. Deleted right
 * after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [websiteAuditEntries, recentEnquiries, recentAnyAudit] = await Promise.all([
    prisma.gymAuditLog.findMany({
      where: { action: "ENQUIRY_CREATED_FROM_WEBSITE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, entityId: true, metadata: true },
    }),
    prisma.gymEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        status: true,
        source: true,
        category: true,
        messages: { select: { direction: true, createdAt: true } },
      },
    }),
    prisma.gymAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, action: true, entityType: true },
    }),
  ]);

  return NextResponse.json({
    nowUtc: new Date().toISOString(),
    websiteWebhookAuditEntries: websiteAuditEntries,
    mostRecentEnquiriesAnySource: recentEnquiries,
    mostRecentAuditLogEntriesAnyType: recentAnyAudit,
    databaseChanged: false,
  });
}
