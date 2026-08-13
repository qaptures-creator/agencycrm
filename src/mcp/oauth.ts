// Verifies WorkOS AuthKit access tokens for the PRMOTE MCP resource server.
//
// This app is a pure OAuth *resource server* here, not a client and not the
// authorization server — WorkOS issues and signs the tokens, we only check
// them. Verification is fully offline against WorkOS's public JWKS (no
// WorkOS secret key involved, no network call back to WorkOS needed beyond
// fetching/caching the public signing keys), so there's no WORKOS_API_KEY
// or WORKOS_CLIENT_ID to configure — see MCP_SETUP.md for why.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

function publicAppUrl() {
  return process.env.APP_URL?.replace(/\/+$/, "");
}

/** The MCP resource this server represents — the value WorkOS access tokens must carry as `aud`. */
export function mcpResourceUrl() {
  const base = publicAppUrl();
  return base ? `${base}/api/mcp` : undefined;
}

function issuer() {
  return process.env.MCP_OAUTH_ISSUER?.replace(/\/+$/, "");
}

function jwksUrl() {
  return process.env.MCP_OAUTH_JWKS_URL || (issuer() ? `${issuer()}/oauth2/jwks` : undefined);
}

export function isOAuthConfigured() {
  return Boolean(issuer() && jwksUrl() && mcpResourceUrl());
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks() {
  const url = jwksUrl();
  if (!url) throw new Error("MCP_OAUTH_JWKS_URL (or MCP_OAUTH_ISSUER) is not configured.");
  if (!cachedJwks) cachedJwks = createRemoteJWKSet(new URL(url));
  return cachedJwks;
}

function scopesFromClaims(payload: JWTPayload): string[] {
  const scope = payload.scope;
  if (typeof scope === "string") return scope.split(" ").filter(Boolean);
  const scp = (payload as Record<string, unknown>).scp;
  if (Array.isArray(scp)) return scp.filter((s): s is string => typeof s === "string");
  return [];
}

export type WorkosTokenInfo = {
  payload: JWTPayload;
  scopes: string[];
};

/**
 * Verifies a WorkOS-issued access token: signature (via JWKS), issuer,
 * audience (bound to this exact MCP resource — RFC 8707), and standard
 * expiry/not-before checks (both handled by `jwtVerify` itself). Throws on
 * any failure; callers treat that as "not a valid token" and decide what to
 * do next (e.g. fall back to another credential, or reject).
 */
export async function verifyWorkosAccessToken(token: string): Promise<WorkosTokenInfo> {
  if (!isOAuthConfigured()) {
    throw new Error("OAuth is not configured on this server (MCP_OAUTH_ISSUER / MCP_OAUTH_JWKS_URL / APP_URL).");
  }
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: issuer(),
    audience: mcpResourceUrl(),
  });
  return { payload, scopes: scopesFromClaims(payload) };
}
