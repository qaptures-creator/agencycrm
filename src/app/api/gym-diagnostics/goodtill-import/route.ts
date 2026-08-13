import { NextResponse } from "next/server";
import { runGoodtillHistoricalImport } from "@/lib/gym/integrations/goodtill-sync";

/**
 * TEMPORARY one-off trigger for the full historical sales backfill — run
 * once, then this route is deleted. Token-gated (GOODTILL_DIAGNOSTIC_TOKEN)
 * rather than a gym session so it can be curled directly. Safe to call
 * more than once: every upsert is keyed on Goodtill's own id.
 */
export async function POST(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await runGoodtillHistoricalImport();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 502 });
  }
}
