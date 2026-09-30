import { NextResponse } from "next/server";
import { syncAshbourneMembers } from "@/lib/ashbourne/sync";

/** TEMPORARY — token-gated. Runs a real dry-run sync (no DB writes to
 * members/memberships — only the run's own GymAshbourneSyncLog row) to
 * verify the new fetchAshbourneAllMembersCsv() end-to-end flow before a real
 * sync is approved. The real server action (dryRunAshbourneSyncAction)
 * requires a logged-in session cookie this diagnostic doesn't have, so this
 * calls syncAshbourneMembers directly instead. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await syncAshbourneMembers({ dryRun: true });
  return NextResponse.json(result);
}
