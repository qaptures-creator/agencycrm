// Small helpers so every MCP tool returns the same shape of result. Tool
// callbacks return CallToolResult = { content: [{ type: "text", text }], isError? }.

import { McpToolError } from "@/mcp/resolve";

export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true as const };
}

/** Wraps a tool handler so thrown errors become clean MCP error results instead of raw stack traces. */
export function safeTool<Args, R>(fn: (args: Args) => Promise<R>) {
  return async (args: Args) => {
    try {
      const result = await fn(args);
      return jsonResult(result);
    } catch (err) {
      if (err instanceof McpToolError) return errorResult(err.message);
      console.error("[mcp] tool error:", err);
      return errorResult("Something went wrong handling that request.");
    }
  };
}
