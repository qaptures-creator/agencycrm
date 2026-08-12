import { NextRequest, NextResponse } from "next/server";
import { listCalendarEvents } from "@/lib/microsoft-graph";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  try {
    const events = await listCalendarEvents(start, end);
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load calendar" }, { status: 502 });
  }
}
