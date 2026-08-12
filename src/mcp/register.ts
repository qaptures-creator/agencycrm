import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "@/mcp/read-tools";
import { registerWriteTools } from "@/mcp/write-tools";

export function registerAllTools(server: McpServer) {
  registerReadTools(server);
  registerWriteTools(server);
}
