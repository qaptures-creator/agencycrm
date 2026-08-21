import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

/**
 * Website enquiry receiver — for the musclemassacre.com Contact Form 7
 * submission to POST into the existing Enquiries pipeline. Mirrors the
 * shared-secret + timingSafeEqual pattern already established by
 * src/app/api/gym/webhooks/goodtill/route.ts, and creates a GymEnquiry the
 * exact same way createEnquiryAction (src/actions/gym/enquiries.ts) does —
 * that action requires a logged-in GymUser (it's for staff manually adding
 * an enquiry), which a server-to-server webhook can't have, so this route
 * reimplements the same Prisma shape rather than calling it directly.
 *
 * Contract: WordPress is responsible for mapping its own raw CF7 field
 * names (your-name, your-email, etc.) to this endpoint's normalized JSON
 * shape — that mapping happens outside this codebase. This route only
 * validates/accepts the normalized payload.
 *
 * Every submission becomes an enquiry — nothing is silently dropped for
 * matching an existing member/lead. GymEnquiry has no dedicated field for
 * "this came from someone who might already be a member/lead" (its only
 * member-linking field, convertedMemberId, means something different — an
 * enquiry a staff member explicitly converted into a member — reusing it
 * here would corrupt that meaning). So a best-effort email/phone match
 * against GymMember/GymLead is surfaced two ways instead: a short note
 * prepended to the enquiry's message so front-line staff see it
 * immediately, and matchedMemberId/matchedLeadId in the audit log entry
 * for anyone auditing later. No schema change.
 */

export const dynamic = "force-dynamic";

const SECRET_HEADER = "x-website-webhook-secret";

function isValidSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // must check before timingSafeEqual — it throws on length mismatch
  return timingSafeEqual(a, b);
}

// No distributed rate-limiting infrastructure exists in this project yet
// (no Redis/Upstash, no middleware.ts). This is a minimal, self-contained,
// best-effort guard scoped to this single route — per-IP sliding window,
// in-memory. It resets on redeploy and only protects a single running
// instance; it is not a substitute for a real distributed limiter if
// traffic ever justifies one.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 5000) requestLog.clear(); // crude unbounded-growth guard
  return recent.length > RATE_LIMIT_MAX_PER_WINDOW;
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const payloadSchema = z
  .object({
    name: z.preprocess(emptyToUndefined, z.string().min(1).max(200)),
    email: z.preprocess(emptyToUndefined, z.string().max(320).optional()),
    phone: z.preprocess(emptyToUndefined, z.string().max(40).optional()),
    existingMember: z.union([z.boolean(), z.string()]).optional(),
    enquiryType: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
    interest: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
    message: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
    source: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  })
  .strict(); // rejects any field not listed above

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(s: string, maxLen: number): string {
  // Strips control characters (except \n\t already excluded via the ranges
  // below) — defense in depth; nothing here is ever rendered as HTML.
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, maxLen);
}

const ENQUIRY_TYPE_MAP: Record<string, string> = {
  membership: "MEMBERSHIP",
  "day pass": "DAY_PASS",
  daypass: "DAY_PASS",
  general: "GENERAL",
  "general question": "GENERAL",
  cancellation: "CANCELLATION",
  payment: "PAYMENT",
  complaint: "COMPLAINT",
  "personal training": "PERSONAL_TRAINING",
  pt: "PERSONAL_TRAINING",
  facilities: "FACILITIES",
  business: "BUSINESS",
};

/** Maps free-text enquiryType to the existing ENQUIRY_CATEGORIES enum —
 * anything unrecognized falls through to the category schema's own
 * existing "OTHER" default rather than being invented or guessed. */
function mapEnquiryType(raw: string | undefined): string {
  if (!raw) return "OTHER";
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return ENQUIRY_TYPE_MAP[key] ?? "OTHER";
}

function isTruthyFlag(v: boolean | string | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "yes", "1"].includes(v.trim().toLowerCase());
  return false;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A handful of exact-match string variants (not a full-table scan) that
 * tolerate the most common UK phone formatting differences: with/without
 * spaces, leading 0 vs +44. */
function phoneMatchVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];
  const variants = new Set<string>([phone.trim(), digits]);
  if (digits.startsWith("44")) variants.add("0" + digits.slice(2));
  if (digits.startsWith("0")) variants.add("+44" + digits.slice(1));
  return Array.from(variants);
}

async function findExistingMatch(email: string | undefined, phone: string | undefined) {
  const conditions: Array<{ email?: { equals: string; mode: "insensitive" } } | { phone: { in: string[] } }> = [];
  if (email) conditions.push({ email: { equals: email, mode: "insensitive" } });
  const phoneVariants = phone ? phoneMatchVariants(phone) : [];
  if (phoneVariants.length > 0) conditions.push({ phone: { in: phoneVariants } });
  if (conditions.length === 0) return { member: null, lead: null };

  const [member, lead] = await Promise.all([
    prisma.gymMember.findFirst({ where: { OR: conditions }, select: { id: true } }),
    prisma.gymLead.findFirst({ where: { OR: conditions }, select: { id: true } }),
  ]);
  return { member, lead };
}

// One structured line per request, at every exit point — safe fields only
// (booleans, an id, a category string): never the secret, cookies, message
// body, or raw email/phone. This is the primary diagnostic trail for this
// route; grep Railway deploy logs for "website_enquiry_webhook".
function logStage(fields: Record<string, string | boolean | number | null>) {
  const line = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`website_enquiry_webhook ${line}`);
}

export async function POST(req: Request) {
  const expectedSecret = process.env.WEBSITE_ENQUIRY_WEBHOOK_SECRET;
  if (!expectedSecret) {
    logStage({ received: true, authenticated: false, reason: "not_configured" });
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  if (!isValidSecret(req.headers.get(SECRET_HEADER), expectedSecret)) {
    logStage({ received: true, authenticated: false });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimitKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(rateLimitKey)) {
    logStage({ received: true, authenticated: true, reason: "rate_limited" });
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
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

  const name = sanitizeText(data.name, 200);
  if (!name) {
    logStage({ received: true, authenticated: true, validation: false, reason: "empty_name" });
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const emailRaw = data.email ? sanitizeText(data.email, 320) : undefined;
  const email = emailRaw && EMAIL_SHAPE.test(emailRaw) ? normalizeEmail(emailRaw) : undefined;
  const phone = data.phone ? sanitizeText(data.phone, 40) : undefined;
  const category = mapEnquiryType(data.enquiryType);
  const subject = data.interest ? sanitizeText(data.interest, 300) : undefined;
  const existingMemberClaim = isTruthyFlag(data.existingMember);

  const messageBody =
    [existingMemberClaim ? "Existing member (self-reported on website form): Yes" : null, data.message ? sanitizeText(data.message, 5000) : null]
      .filter((s): s is string => !!s)
      .join("\n\n") || undefined;

  // ?dryRun=1 — validates and runs the same matching lookup as a real
  // submission, but never writes anything. Lets WordPress/the team test
  // end-to-end (secret, payload shape, connectivity) without creating
  // production enquiries.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  try {
    const { member, lead } = await findExistingMatch(email, phone);

    if (dryRun) {
      logStage({ received: true, authenticated: true, validation: true, dryRun: true, created: false });
      return NextResponse.json({ ok: true, dryRun: true });
    }

    const enquiry = await prisma.gymEnquiry.create({
      data: {
        name,
        email,
        phone,
        subject,
        category,
        status: "NEW",
        source: "WEBSITE",
        messages: messageBody ? { create: { direction: "INBOUND", body: messageBody, fromEmail: email } } : undefined,
      },
    });

    await notifyManagement({
      type: "NEW_ENQUIRY",
      title: `New website enquiry — ${enquiry.name}`,
      body: subject,
      link: `/gym/enquiries?enquiry=${enquiry.id}`,
    });

    // Structured, PII-minimal: entity id + category + which system matches
    // fired, never the message body or raw email/phone.
    await logAudit({
      action: "ENQUIRY_CREATED_FROM_WEBSITE",
      entityType: "GymEnquiry",
      entityId: enquiry.id,
      metadata: { category, matchedMemberId: member?.id ?? null, matchedLeadId: lead?.id ?? null },
    });

    logStage({ received: true, authenticated: true, validation: true, dryRun: false, created: true, enquiryId: enquiry.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logStage({ received: true, authenticated: true, validation: true, dryRun, created: false, reason: "exception" });
    console.error("website-enquiry webhook processing failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

/** Reachability check — safe to hit from a browser or WordPress's own
 * "test connection" step; reveals nothing about configuration. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "website-enquiry-webhook" });
}
