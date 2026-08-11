import { ConfidentialClientApplication } from "@azure/msal-node";
import { prisma } from "@/lib/prisma";

export const GRAPH_SCOPES = ["Mail.Read", "Files.ReadWrite", "User.Read", "offline_access"];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

export function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: requireEnv("MICROSOFT_CLIENT_ID"),
      authority: `https://login.microsoftonline.com/${requireEnv("MICROSOFT_TENANT_ID")}`,
      clientSecret: requireEnv("MICROSOFT_CLIENT_SECRET"),
    },
  });
}

export function isMicrosoftConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID
  );
}

/**
 * The redirect URI MUST exactly match what's registered in Azure, and MUST be
 * identical between the initial authorize request and the token exchange.
 * We deliberately don't derive this from the incoming request (req.nextUrl.origin)
 * — behind Railway's proxy that can resolve to an internal address like
 * localhost:8080 instead of the public domain, which Azure then rejects
 * (AADSTS50011). APP_URL must be set to the real public app URL, e.g.
 * https://prmote-production.up.railway.app
 */
export function getMicrosoftRedirectUri() {
  const base = requireEnv("APP_URL").replace(/\/+$/, "");
  return `${base}/api/auth/microsoft/callback`;
}

export async function getAuthUrl(redirectUri: string) {
  const client = getMsalClient();
  return client.getAuthCodeUrl({
    scopes: GRAPH_SCOPES,
    redirectUri,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const client = getMsalClient();
  const result = await client.acquireTokenByCode({
    code,
    scopes: GRAPH_SCOPES,
    redirectUri,
  });
  if (!result?.account?.username || !result.accessToken) {
    throw new Error("Microsoft did not return a valid token response");
  }

  // msal-node doesn't surface the refresh token on the public result type for
  // the auth-code flow — it's retained in msal's token cache instead. Pull it
  // out of the serialized cache so we can persist and use it ourselves later
  // (we manage our own single-row connection rather than msal's cache store).
  const cache = client.getTokenCache().serialize();
  const parsed = JSON.parse(cache) as { RefreshToken?: Record<string, { secret: string }> };
  const refreshToken = Object.values(parsed.RefreshToken ?? {})[0]?.secret;
  if (!refreshToken) throw new Error("Microsoft did not return a refresh token");

  await prisma.microsoftConnection.deleteMany({});
  await prisma.microsoftConnection.create({
    data: {
      email: result.account.username,
      accessToken: result.accessToken,
      refreshToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 55 * 60 * 1000),
    },
  });

  return result.account.username;
}

export async function getConnection() {
  return prisma.microsoftConnection.findFirst();
}

/** Returns a valid access token, refreshing it first if it's expired or close to it. */
export async function getValidAccessToken() {
  const connection = await prisma.microsoftConnection.findFirst();
  if (!connection) return null;

  const expiresSoon = connection.expiresAt.getTime() - Date.now() < 2 * 60 * 1000;
  if (!expiresSoon) return connection.accessToken;

  const client = getMsalClient();
  const result = await client.acquireTokenByRefreshToken({
    refreshToken: connection.refreshToken,
    scopes: GRAPH_SCOPES,
  });
  if (!result?.accessToken) return null;

  const cache = client.getTokenCache().serialize();
  const parsed = JSON.parse(cache) as { RefreshToken?: Record<string, { secret: string }> };
  const refreshToken = Object.values(parsed.RefreshToken ?? {})[0]?.secret ?? connection.refreshToken;

  await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: result.accessToken,
      refreshToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 55 * 60 * 1000),
    },
  });

  return result.accessToken;
}

export async function disconnectMicrosoft() {
  await prisma.microsoftConnection.deleteMany({});
}
