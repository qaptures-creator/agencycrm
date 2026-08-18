import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * TEMPORARY — audits real member address/postcode coverage before building
 * the Member Map feature. Token-gated, aggregate counts only (plus a
 * handful of raw samples to validate postcode-extraction regex against
 * real formatting). Deleted right after use.
 */
const UK_POSTCODE_RE = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;

export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const settings = await prisma.gymSettings.findUnique({ where: { id: "singleton" } });

  const members = await prisma.gymMember.findMany({ select: { id: true, address: true } });
  const total = members.length;
  const withAddress = members.filter((m) => m.address && m.address.trim().length > 0);
  const withPostcode = withAddress.filter((m) => UK_POSTCODE_RE.test(m.address!));

  const areaCounts = new Map<string, number>();
  for (const m of withPostcode) {
    const match = m.address!.match(UK_POSTCODE_RE);
    if (!match) continue;
    const pc = match[0].toUpperCase().replace(/\s+/g, " ").trim();
    const area = pc.match(/^[A-Z]{1,2}/)?.[0] ?? "?";
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }
  const topAreas = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  // A few raw samples to sanity-check formatting (not returned in bulk).
  const samples = withAddress.slice(0, 5).map((m) => ({ id: m.id, address: m.address }));
  const noPostcodeSamples = withAddress.filter((m) => !UK_POSTCODE_RE.test(m.address!)).slice(0, 5).map((m) => ({ id: m.id, address: m.address }));

  return NextResponse.json({
    gymAddress: settings?.address ?? null,
    gymName: settings?.gymName ?? null,
    total,
    withAddress: withAddress.length,
    withPostcodeMatch: withPostcode.length,
    withoutAddress: total - withAddress.length,
    addressButNoPostcodeMatch: withAddress.length - withPostcode.length,
    topAreas,
    samples,
    noPostcodeSamples,
  });
}
