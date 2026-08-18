import { NextRequest, NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { getMessageRow } from "@/lib/gym/email-data";
import { fetchAttachment } from "@/lib/email/message-detail";

/** Streams a single email attachment straight from IMAP — never staged on
 * disk. The filename is sanitized server-side (see sanitizeAttachmentFilename)
 * before it's ever used in a response header. */
export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user || !can(user.accessRole as GymAccessRole, "viewEmail")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const messageId = req.nextUrl.searchParams.get("messageId");
  const indexParam = req.nextUrl.searchParams.get("index");
  const index = indexParam ? Number(indexParam) : NaN;
  if (!messageId || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const row = await getMessageRow(messageId);
  if (!row) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  try {
    const attachment = await fetchAttachment(row.imapPath, row.imapUid, index);
    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(attachment.content), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `attachment; filename="${attachment.filename.replace(/"/g, "")}"`,
        "Content-Length": String(attachment.content.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch attachment";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
