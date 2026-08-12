import { NextResponse } from "next/server";

// Unauthenticated on purpose — a plain reachability check, no CRM data.
export async function GET() {
  return NextResponse.json({ ok: true, service: "PRMOTE MCP" });
}
