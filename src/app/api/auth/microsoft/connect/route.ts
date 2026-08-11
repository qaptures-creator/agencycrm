import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl, isMicrosoftConfigured } from "@/lib/microsoft-auth";

export async function GET(req: NextRequest) {
  if (!isMicrosoftConfigured()) {
    return NextResponse.json(
      { error: "Microsoft 365 isn't configured. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and MICROSOFT_TENANT_ID." },
      { status: 400 }
    );
  }

  const redirectUri = new URL("/api/auth/microsoft/callback", req.nextUrl.origin).toString();
  const authUrl = await getAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
