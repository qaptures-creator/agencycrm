import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/microsoft-auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  const settingsUrl = new URL("/settings", req.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("microsoft_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("microsoft_error", "No authorization code returned");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = new URL("/api/auth/microsoft/callback", req.nextUrl.origin).toString();
    const email = await exchangeCodeForTokens(code, redirectUri);
    settingsUrl.searchParams.set("microsoft_connected", email);
  } catch (err) {
    settingsUrl.searchParams.set("microsoft_error", err instanceof Error ? err.message : "Connection failed");
  }

  return NextResponse.redirect(settingsUrl);
}
