import { NextResponse } from "next/server";
import {
  testGoodtillConnection,
  getGoodtillOutlets,
  getGoodtillCategories,
  getGoodtillProducts,
  getGoodtillProductInventory,
} from "@/lib/gym/integrations/goodtill-client";

/**
 * TEMPORARY diagnostic endpoint used to verify the Goodtill/SumUp
 * connection while building the Shake Bar integration. Gated by a
 * one-off token (GOODTILL_DIAGNOSTIC_TOKEN) rather than a gym session so
 * it can be curled directly. Returns small, redacted samples only — no
 * token, password, or full product/sale lists. Delete this route once the
 * integration is confirmed working.
 */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const connection = await testGoodtillConnection();
  if (!connection.ok) {
    return NextResponse.json({ connection }, { status: 502 });
  }

  async function sample<T>(label: string, fn: () => Promise<T[]>) {
    try {
      const items = await fn();
      return { label, count: items.length, sample: items.slice(0, 3) };
    } catch (err) {
      return { label, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  const [outlets, categories, products, inventory] = await Promise.all([
    sample("outlets", getGoodtillOutlets),
    sample("categories", getGoodtillCategories),
    sample("products", getGoodtillProducts),
    sample("productInventory", getGoodtillProductInventory),
  ]);

  return NextResponse.json({ connection, outlets, categories, products, inventory });
}
