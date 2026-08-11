import { NextResponse } from "next/server";
import { getAuthUrl, getMicrosoftRedirectUri, isMicrosoftConfigured } from "@/lib/microsoft-auth";

export async function GET() {
  if (!isMicrosoftConfigured()) {
    return NextResponse.json(
      { error: "Microsoft 365 isn't configured. Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID and APP_URL." },
      { status: 400 }
    );
  }

  const authUrl = await getAuthUrl(getMicrosoftRedirectUri());
  return NextResponse.redirect(authUrl);
}
