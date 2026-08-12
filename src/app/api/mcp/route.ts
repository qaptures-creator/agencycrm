import { createMcpHandler } from "mcp-handler";
import { registerAllTools } from "@/mcp/register";
import { checkMcpAuth } from "@/mcp/auth";

// Remote MCP endpoint for PRMOTE, meant for a single trusted client (ChatGPT).
// Streamable HTTP only (SSE disabled — deprecated by the current MCP spec and
// unnecessary here). Auth is a static bearer token checked in front of the
// handler; see src/mcp/auth.ts and MCP_SETUP.md for why that's the right
// amount of security for a private single-tenant integration.
const mcpHandler = createMcpHandler(
  (server) => {
    registerAllTools(server);
  },
  { serverInfo: { name: "PRMOTE MCP", version: "1.0.0" } },
  { streamableHttpEndpoint: "/api/mcp", disableSse: true }
);

async function handler(req: Request) {
  const denied = checkMcpAuth(req);
  if (denied) return denied;
  return mcpHandler(req);
}

export { handler as GET, handler as POST };
