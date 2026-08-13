import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncGoodtillSaleById, recordGoodtillWebhookReceived } from "@/lib/gym/integrations/goodtill-sync";

/**
 * Goodtill/SumUp POS webhook receiver — see
 * https://support.thegoodtill.com/support/webhook. Configured in the
 * Goodtill backoffice at https://pos.thegoodtill.com/app/integrations/webhook
 * to POST here on `sale.completed` (and possibly other events the backoffice
 * is subscribed to — anything besides sale.completed is acknowledged and
 * ignored).
 *
 * The payload only carries a sale id (`data.sale.id`), not the full sale —
 * this handler fetches the real sale via the Goodtill API and upserts it.
 *
 * Idempotency: keyed on the webhook's own `message_id`. A delivery whose
 * message_id already succeeded is acknowledged without reprocessing; one
 * that previously failed is retried (so Goodtill's built-in "retry ~1 hour
 * later on non-200" gives us a real recovery path for transient Goodtill
 * API failures). The sale itself is also upserted by its Goodtill id, so
 * even a genuine double-process can't create a duplicate sale row.
 */

export const dynamic = "force-dynamic";

type GoodtillWebhookPayload = {
  message_id?: string;
  event?: string;
  attempt?: number;
  data?: { sale?: { id?: string } };
};

function isValidToken(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // must check before timingSafeEqual — it throws on length mismatch
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expectedToken = process.env.GOODTILL_WEBHOOK_VERIFICATION_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const providedToken = req.headers.get("verification-token");
  if (!isValidToken(providedToken, expectedToken)) {
    return NextResponse.json({ error: "invalid verification token" }, { status: 401 });
  }

  let payload: GoodtillWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!payload.message_id || !payload.event) {
    return NextResponse.json({ error: "missing message_id/event" }, { status: 400 });
  }

  const alreadyProcessed = await prisma.gymPosWebhookEvent.findUnique({
    where: { messageId: payload.message_id },
    select: { status: true },
  });
  if (alreadyProcessed?.status === "OK") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.gymPosWebhookEvent.upsert({
    where: { messageId: payload.message_id },
    create: {
      messageId: payload.message_id,
      event: payload.event,
      saleExternalId: payload.data?.sale?.id ?? null,
      status: "PENDING",
    },
    update: { event: payload.event, saleExternalId: payload.data?.sale?.id ?? null, status: "PENDING", error: null },
  });

  if (payload.event !== "sale.completed") {
    await prisma.gymPosWebhookEvent.update({ where: { messageId: payload.message_id }, data: { status: "OK" } });
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  const saleId = payload.data?.sale?.id;
  if (!saleId) {
    await prisma.gymPosWebhookEvent.update({
      where: { messageId: payload.message_id },
      data: { status: "ERROR", error: "sale.completed payload missing data.sale.id" },
    });
    return NextResponse.json({ error: "missing sale id" }, { status: 400 });
  }

  try {
    await syncGoodtillSaleById(saleId, "WEBHOOK");
    await Promise.all([
      prisma.gymPosWebhookEvent.update({ where: { messageId: payload.message_id }, data: { status: "OK" } }),
      recordGoodtillWebhookReceived(payload.event),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.gymPosWebhookEvent.update({
      where: { messageId: payload.message_id },
      data: { status: "ERROR", error: message },
    });
    return NextResponse.json({ error: "processing failed" }, { status: 502 });
  }
}

/** Lets Goodtill's backoffice "test webhook" button (or a curious browser)
 * get a response instead of a 404, without revealing anything. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "goodtill-webhook" });
}
