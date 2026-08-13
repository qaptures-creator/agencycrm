// Auth for the MCP endpoint, used as the `verifyToken` callback for
// mcp-handler's `withMcpAuth` (see src/app/api/mcp/route.ts).
//
// Two credentials are accepted, checked in this order:
//   1. A WorkOS-issued OAuth access token (verified via src/mcp/oauth.ts) —
//      the real, ChatGPT-compatible path.
//   2. The legacy static PRMOTE_MCP_API_KEY, kept only as a temporary
//      fallback per explicit instruction while the OAuth path is being
//      proven out. Remove once ChatGPT OAuth is confirmed working
//      end-to-end (see MCP_SETUP.md).
// A request with neither is rejected — there is no anonymous path.

import { createHash, timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { isOAuthConfigured, verifyWorkosAccessToken } from "@/mcp/oauth";

function safeEqual(a: string, b: string) {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function isMcpAuthConfigured() {
  return isOAuthConfigured() || Boolean(process.env.PRMOTE_MCP_API_KEY);
}

export async function verifyMcpBearerToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  if (isOAuthConfigured()) {
    try {
      const { payload, scopes } = await verifyWorkosAccessToken(bearerToken);
      const clientId = typeof payload.client_id === "string" ? payload.client_id : (payload.sub ?? "workos-user");
      return {
        token: bearerToken,
        clientId,
        scopes,
        expiresAt: payload.exp,
      };
    } catch {
      // Not a valid WorkOS token — fall through to the legacy key check
      // below rather than rejecting immediately, since both paths are
      // accepted during the transition.
    }
  }

  const legacyKey = process.env.PRMOTE_MCP_API_KEY;
  if (legacyKey && safeEqual(bearerToken, legacyKey)) {
    return { token: bearerToken, clientId: "legacy-api-key", scopes: ["legacy"] };
  }

  return undefined;
}
