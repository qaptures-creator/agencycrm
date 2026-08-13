import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAllTools } from "@/mcp/register";
import { verifyMcpBearerToken, isMcpAuthConfigured } from "@/mcp/auth";

// Remote MCP endpoint for PRMOTE, meant for a single trusted client (ChatGPT).
// Streamable HTTP only (SSE disabled — deprecated by the current MCP spec and
// unnecessary here).
//
// Auth: OAuth 2.1 (WorkOS AuthKit, verified in src/mcp/oauth.ts) with a
// temporary legacy-API-key fallback — both are checked in
// src/mcp/auth.ts#verifyMcpBearerToken. `withMcpAuth` enforces this on every
// request (`required: true` — without it, unauthenticated requests would be
// passed straight through to the tools) and emits the spec-correct 401 +
// WWW-Authenticate header pointing at /.well-known/oauth-protected-resource
// on failure. `resourceUrl` is pinned to APP_URL rather than left to
// proxy-header autodetection — Railway's proxy has bitten us on this before
// (see the Microsoft OAuth redirect URI fix in src/lib/microsoft-auth.ts).
const mcpHandler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  { serverInfo: { name: "PRMOTE MCP", version: "1.0.0" } },
  { streamableHttpEndpoint: "/api/mcp", disableSse: true }
);

const authedMcpHandler = withMcpAuth(mcpHandler, verifyMcpBearerToken, {
  required: true,
  resourceUrl: process.env.APP_URL,
});

async function handler(req: Request) {
  if (!isMcpAuthConfigured()) {
    return Response.json(
      {
        error:
          "PRMOTE MCP is not configured (set MCP_OAUTH_ISSUER + MCP_OAUTH_JWKS_URL for OAuth, and/or PRMOTE_MCP_API_KEY, on the server).",
      },
      { status: 503 }
    );
  }
  return authedMcpHandler(req);
}

export { handler as GET, handler as POST };
