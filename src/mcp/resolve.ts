// Shared "find by id or human-readable name" lookups for MCP tools.
// ChatGPT will usually refer to records by name ("NP Coaches", "Proposal
// Sent"), not by cuid, so every tool that needs a specific record accepts
// either and resolves it here — ambiguous name matches are surfaced as an
// error listing candidates rather than silently picking one.

import { prisma } from "@/lib/prisma";

export class McpToolError extends Error {}

async function resolveByIdOrName<T extends { id: string }>(
  label: string,
  idOrName: string,
  findById: (id: string) => Promise<T | null>,
  findByName: (query: string) => Promise<T[]>,
  displayName: (record: T) => string
): Promise<T> {
  const trimmed = idOrName.trim();
  if (!trimmed) throw new McpToolError(`${label} is required.`);

  const byId = await findById(trimmed);
  if (byId) return byId;

  const matches = await findByName(trimmed);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new McpToolError(`No ${label.toLowerCase()} found matching "${idOrName}".`);
  }
  const names = matches.slice(0, 10).map(displayName).join(", ");
  throw new McpToolError(
    `"${idOrName}" matches multiple ${label.toLowerCase()}s (${names}). Be more specific or pass the exact id.`
  );
}

export function resolveClient(idOrName: string) {
  return resolveByIdOrName(
    "Client",
    idOrName,
    (id) => prisma.client.findUnique({ where: { id } }),
    (query) =>
      prisma.client.findMany({
        where: { companyName: { contains: query, mode: "insensitive" } },
        take: 10,
      }),
    (c) => c.companyName
  );
}

export function resolveLead(idOrName: string) {
  return resolveByIdOrName(
    "Lead",
    idOrName,
    (id) => prisma.lead.findUnique({ where: { id } }),
    (query) =>
      prisma.lead.findMany({
        where: { companyName: { contains: query, mode: "insensitive" } },
        take: 10,
      }),
    (l) => l.companyName
  );
}

export function resolveStage(nameOrId: string) {
  return resolveByIdOrName(
    "Pipeline stage",
    nameOrId,
    (id) => prisma.pipelineStage.findUnique({ where: { id } }),
    (query) =>
      prisma.pipelineStage.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        take: 10,
      }),
    (s) => s.name
  );
}

export function resolveDeliverableStatus(nameOrId: string) {
  return resolveByIdOrName(
    "Deliverable status",
    nameOrId,
    (id) => prisma.deliverableStatusOption.findUnique({ where: { id } }),
    (query) =>
      prisma.deliverableStatusOption.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        take: 10,
      }),
    (s) => s.name
  );
}

export function resolveUser(nameOrId: string) {
  return resolveByIdOrName(
    "User",
    nameOrId,
    (id) => prisma.user.findUnique({ where: { id } }),
    (query) =>
      prisma.user.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        take: 10,
      }),
    (u) => u.name
  );
}

/** Activity records are used as the "task" surface — validates the id exists before mutating it. */
export async function resolveTask(id: string) {
  const trimmed = id.trim();
  if (!trimmed) throw new McpToolError("Task id is required.");
  const activity = await prisma.activity.findUnique({ where: { id: trimmed } });
  if (!activity) throw new McpToolError(`No task found with id "${id}".`);
  return activity;
}
