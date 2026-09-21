import { NextResponse } from "next/server";
import { withAshbourneBrowser } from "@/lib/ashbourne/client";
import { loginToAshbourne } from "@/lib/ashbourne/auth";
import { fetchAshbourneMembers } from "@/lib/ashbourne/reports";
import { AshbourneConnectorError } from "@/lib/ashbourne/types";

export const dynamic = "force-dynamic";

/** TEMPORARY — read-only against both our DB (none touched) and Ashbourne
 * (the exact same report fetch a dry-run sync already performs). Checking
 * whether the "New Members (All)" report even has Membership Type/Status
 * columns, since real syncs are finding/matching members but never writing
 * non-null ashbourneStatus/ashbourneMembershipType. Deleted right after
 * use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await withAshbourneBrowser(async (page, config) => {
      await loginToAshbourne(page, config);
      return fetchAshbourneMembers(page, config);
    });

    return NextResponse.json({
      reportUrl: result.debug?.reportUrl,
      columnsFound: result.debug?.columnsFound,
      totalMembersFound: result.members.length,
      sample: result.members.slice(0, 8),
    });
  } catch (err) {
    if (err instanceof AshbourneConnectorError) {
      return NextResponse.json({ error: `[${err.step}] ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
}
