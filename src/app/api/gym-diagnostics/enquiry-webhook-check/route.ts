import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only. Checks the database directly (authoritative,
 * unaffected by HTTP proxy log shipping delay) for whether the website
 * enquiry webhook has ever actually created a record, plus the most
 * recent enquiries/audit entries of any source for context. No writes,
 * no message bodies, no raw email/phone. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [websiteAuditEntries, recentEnquiries, secretConfigured] = await Promise.all([
    prisma.gymAuditLog.findMany({
      where: { action: "ENQUIRY_CREATED_FROM_WEBSITE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, entityId: true, metadata: true },
    }),
    prisma.gymEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, createdAt: true, status: true, source: true, category: true },
    }),
    Promise.resolve(!!process.env.WEBSITE_ENQUIRY_WEBHOOK_SECRET),
  ]);

  return NextResponse.json({
    nowUtc: new Date().toISOString(),
    secretConfiguredOnThisDeployment: secretConfigured,
    websiteWebhookAuditEntries: websiteAuditEntries,
    mostRecentEnquiriesAnySource: recentEnquiries,
    databaseChanged: false,
  });
}
