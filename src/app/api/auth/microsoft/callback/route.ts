import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getMicrosoftRedirectUri } from "@/lib/microsoft-auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");

  // Built from APP_URL (not req.nextUrl.origin) for the same reason as the
  // redirect URI itself — behind Railway's proxy the request's own origin
  // can resolve to an internal address the browser can't reach.
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "") ?? req.nextUrl.origin;
  const settingsUrl = new URL("/settings", appUrl);

  if (error) {
    settingsUrl.searchParams.set("microsoft_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("microsoft_error", "No authorization code returned");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const email = await exchangeCodeForTokens(code, getMicrosoftRedirectUri());
    settingsUrl.searchParams.set("microsoft_connected", email);
  } catch (err) {
    settingsUrl.searchParams.set("microsoft_error", err instanceof Error ? err.message : "Connection failed");
  }

  return NextResponse.redirect(settingsUrl);
}
