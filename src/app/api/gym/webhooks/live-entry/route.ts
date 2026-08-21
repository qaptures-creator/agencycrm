import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Live gate-entry receiver for the Ashbourne biometric access log bridge
 * (a Windows watcher tails C:\Ashbourne\MVSv4\Log\mvs-*-log.txt for the
 * "OpenGpioGate ... success" sequence and POSTs the resulting event here —
 * that watcher is a separate, not-yet-built piece; this route is only the
 * CRM receiving side). Mirrors the shared-secret + timingSafeEqual pattern
 * already established by src/app/api/gym/webhooks/website-enquiry/route.ts,
 * but with its own dedicated secret — this endpoint has a different trust
 * boundary (a single gym PC, not a public web form) and must not share a
 * secret with one that does.
 *
 * Privacy: the Ashbourne log line this is derived from contains fingerprint
 * events ("Entry FP Received" etc.) upstream of the "success" line. This
 * endpoint's schema has no field for any biometric payload — the Windows
 * watcher is responsible for reducing a log entry down to the plain access
 * result (memberNumber/entryTime/zone/device/allowed) before it ever
 * reaches here, and `.strict()` below rejects anything else it might send.
 *
 * This is a read-only entry log: it never creates a GymMember and never
 * touches GymMembership/GymMember status fields.
 */

export const dynamic = "force-dynamic";

const SECRET_HEADER = "x-live-entry-webhook-secret";

function isValidSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // must check before timingSafeEqual — it throws on length mismatch
  return timingSafeEqual(a, b);
}

const payloadSchema = z
  .object({
    memberNumber: z.string().trim().min(1).max(50),
    entryTime: z.string().trim().min(1).max(40),
    zone: z.string().trim().min(1).max(100),
    device: z.string().trim().min(1).max(100),
    allowed: z.boolean(),
  })
  .strict(); // rejects any field not listed above — including any fingerprint/biometric field

// One structured line per request, at every exit point — safe fields only
// (booleans, ids, zone/device labels): never the secret or any biometric
// payload. Grep Railway deploy logs for "live_entry_webhook".
function logStage(fields: Record<string, string | boolean | number | null>) {
  const line = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`live_entry_webhook ${line}`);
}

export async function POST(req: Request) {
  const expectedSecret = process.env.LIVE_ENTRY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    logStage({ received: true, authenticated: false, reason: "not_configured" });
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (!isValidSecret(req.headers.get(SECRET_HEADER), expectedSecret)) {
    logStage({ received: true, authenticated: false });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    logStage({ received: true, authenticated: true, validation: false, reason: "invalid_json" });
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    logStage({ received: true, authenticated: true, validation: false, reason: "schema" });
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const data = parsed.data;

  // The bridge sends a bare local (UK) timestamp with no offset, e.g.
  // "2026-08-21T20:18:16" — Node's Date parser treats that as local time
  // in the *server's* timezone (UTC on Railway), not UK time. During BST
  // this is off by an hour from the wall-clock time on the gym PC; exact
  // UK-time normalization is left for when the Windows watcher is built.
  const entryTime = new Date(data.entryTime);
  if (Number.isNaN(entryTime.getTime())) {
    logStage({ received: true, authenticated: true, validation: false, reason: "bad_entry_time" });
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // Only successful access events are ever stored — a denied swipe is
  // acknowledged so the bridge doesn't retry it forever, but nothing is
  // written.
  if (!data.allowed) {
    logStage({ received: true, authenticated: true, validation: true, allowed: false, created: false });
    return NextResponse.json({ ok: true, skipped: "not_allowed" });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  try {
    const member = await prisma.gymMember.findUnique({
      where: { memberNumber: data.memberNumber },
      select: { id: true },
    });

    if (dryRun) {
      logStage({ received: true, authenticated: true, validation: true, dryRun: true, matched: !!member, created: false });
      return NextResponse.json({ ok: true, dryRun: true, matched: !!member });
    }

    // The (memberNumber, device, entryTime) unique constraint is the dedup
    // + idempotency key — a resend of the same log line hits it and is
    // acknowledged as a duplicate instead of racing a separate read-then-
    // write check.
    try {
      const event = await prisma.gymLiveEntryEvent.create({
        data: {
          memberNumber: data.memberNumber,
          entryTime,
          zone: data.zone,
          device: data.device,
          allowed: true,
          source: "ASHBOURNE_LIVE_ENTRY",
          memberId: member?.id ?? null,
        },
        select: { id: true },
      });

      logStage({
        received: true,
        authenticated: true,
        validation: true,
        dryRun: false,
        matched: !!member,
        created: true,
        eventId: event.id,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        logStage({ received: true, authenticated: true, validation: true, dryRun: false, matched: !!member, created: false, dedup: true });
        return NextResponse.json({ ok: true, dedup: true });
      }
      throw err;
    }
  } catch (err) {
    logStage({ received: true, authenticated: true, validation: true, dryRun, created: false, reason: "exception" });
    console.error("live-entry webhook processing failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

/** Reachability check — safe to hit from a browser or the Windows bridge's
 * own connectivity test; reveals nothing about configuration. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "live-entry-webhook" });
}
