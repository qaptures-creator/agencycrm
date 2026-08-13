// RFC 9728 OAuth 2.0 Protected Resource Metadata for the PRMOTE MCP server.
// Unauthenticated on purpose — this is public discovery metadata (which
// authorization server issues tokens for this resource), the same way it's
// referenced from the 401 WWW-Authenticate header on /api/mcp. No CRM data.

import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { mcpResourceUrl } from "@/mcp/oauth";

const issuer = process.env.MCP_OAUTH_ISSUER?.replace(/\/+$/, "");

const handler = protectedResourceHandler({
  authServerUrls: issuer ? [issuer] : [],
  resourceUrl: mcpResourceUrl(),
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
