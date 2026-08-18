import { NextRequest, NextResponse } from "next/server";
import { fetchPlacePhoto, GooglePlacesConfigError } from "@/lib/google-places";

export const dynamic = "force-dynamic";

// Google Place photo names look like "places/<id>/photos/<photoId>" — reject
// anything else so this can't be turned into an arbitrary URL fetcher using
// our server-side API key.
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const widthParam = Number(req.nextUrl.searchParams.get("w") ?? 400);
  const maxWidthPx = Number.isFinite(widthParam) ? Math.min(1600, Math.max(100, Math.round(widthParam))) : 400;

  if (!PHOTO_NAME_RE.test(name)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const res = await fetchPlacePhoto(name, maxWidthPx);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 502 });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    if (err instanceof GooglePlacesConfigError) {
      return NextResponse.json({ error: "GOOGLE_API_KEY_ERROR" }, { status: 503 });
    }
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
