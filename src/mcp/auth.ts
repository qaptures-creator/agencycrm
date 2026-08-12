// Bearer-token auth for the MCP endpoint. This is a private, single-tenant
// integration (the CRM itself has no login system at all — see
// MCP_SETUP.md), so a shared-secret API key checked with a timing-safe
// comparison is the right amount of security here, not a full OAuth
// authorization server. ChatGPT's connector "API key" auth mode sends
// exactly this: `Authorization: Bearer <key>` on every request.

import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function checkMcpAuth(req: Request): Response | null {
  const configuredKey = process.env.PRMOTE_MCP_API_KEY;
  if (!configuredKey) {
    return Response.json(
      { error: "PRMOTE MCP is not configured (missing PRMOTE_MCP_API_KEY on the server)." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token || !safeEqual(token, configuredKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="PRMOTE MCP"' },
    });
  }

  return null;
}
