import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import { safeTool } from "@/mcp/response";
import { resolveClient, resolveLead, resolveStage, resolveTask, McpToolError } from "@/mcp/resolve";
import { auditMcpWrite } from "@/mcp/audit";
import { clientStatusEnum, clientPaymentStatusEnum, activityTypeEnum } from "@/mcp/schema-enums";

const name200 = z.string().min(1).max(200);
const optionalText = (max: number) => z.string().max(max).optional();

function toDate(value: string | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new McpToolError(`"${value}" isn't a valid date/time.`);
  return d;
}

/** Mirrors src/actions/activities.ts createActivity's DB side effects (kept independent — see MCP_SETUP.md on why write tools don't call the "use server" actions directly). */
async function createActivityRecord(input: {
  type: string;
  subject?: string;
  notes?: string;
  dueAt?: Date;
  completedAt?: Date;
  leadId?: string;
  clientId?: string;
}) {
  const activity = await prisma.activity.create({ data: input });
  if (input.leadId) {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { lastContactedAt: new Date(), nextFollowUpAt: input.dueAt ?? undefined },
    });
  }
  return activity;
}

export function registerWriteTools(server: McpServer) {
  server.registerTool(
    "create_lead",
    {
      title: "Create a lead",
      description: "Create a new lead in the pipeline. Defaults to the first pipeline stage (usually \"New Lead\") if stage isn't given.",
      inputSchema: {
        companyName: name200,
        contactName: name200,
        email: z.string().email().optional(),
        phone: optionalText(50),
        instagram: optionalText(100),
        website: optionalText(300),
        industry: optionalText(100),
        location: optionalText(200),
        source: optionalText(100),
        estimatedValue: z.number().min(0).max(10_000_000).optional(),
        notes: optionalText(5000),
        stage: z.string().max(100).optional().describe('Pipeline stage name, e.g. "New Lead"'),
      },
    },
    safeTool(async (args: {
      companyName: string;
      contactName: string;
      email?: string;
      phone?: string;
      instagram?: string;
      website?: string;
      industry?: string;
      location?: string;
      source?: string;
      estimatedValue?: number;
      notes?: string;
      stage?: string;
    }) => {
      const stageRecord = args.stage
        ? await resolveStage(args.stage)
        : await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } });
      if (!stageRecord) throw new McpToolError("No pipeline stages exist yet — create one in Settings first.");

      const maxOrder = await prisma.lead.aggregate({ where: { stageId: stageRecord.id }, _max: { order: true } });
      const lead = await prisma.lead.create({
        data: {
          companyName: args.companyName,
          contactName: args.contactName,
          email: args.email,
          phone: args.phone,
          instagram: args.instagram,
          website: args.website,
          industry: args.industry,
          location: args.location,
          source: args.source,
          estimatedValue: args.estimatedValue,
          notes: args.notes,
          stageId: stageRecord.id,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });
      await auditMcpWrite({ summary: "Lead created through PRMOTE MCP (ChatGPT).", leadId: lead.id });
      return { id: lead.id, companyName: lead.companyName, stage: stageRecord.name, message: "Lead created." };
    })
  );

  server.registerTool(
    "update_lead",
    {
      title: "Update a lead",
      description: "Update a lead's details (not its pipeline stage — use update_lead_stage for that).",
      inputSchema: {
        lead: z.string().describe("Lead id or company name"),
        companyName: name200.optional(),
        contactName: name200.optional(),
        email: z.string().email().optional(),
        phone: optionalText(50),
        instagram: optionalText(100),
        website: optionalText(300),
        industry: optionalText(100),
        location: optionalText(200),
        source: optionalText(100),
        estimatedValue: z.number().min(0).max(10_000_000).optional(),
        notes: optionalText(5000),
      },
    },
    safeTool(async ({ lead, ...fields }: { lead: string } & Record<string, string | number | undefined>) => {
      const record = await resolveLead(lead);
      const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(data).length === 0) throw new McpToolError("No fields to update were provided.");
      const updated = await prisma.lead.update({ where: { id: record.id }, data });
      await auditMcpWrite({ summary: "Lead updated through PRMOTE MCP (ChatGPT).", leadId: record.id });
      return { id: updated.id, companyName: updated.companyName, message: "Lead updated." };
    })
  );

  server.registerTool(
    "update_lead_stage",
    {
      title: "Move a lead to a different pipeline stage",
      description: 'Move a lead to a different pipeline stage, e.g. "Move ABC Fitness to Proposal Sent."',
      inputSchema: {
        lead: z.string().describe("Lead id or company name"),
        stage: z.string().describe('Target pipeline stage name, e.g. "Proposal Sent"'),
      },
    },
    safeTool(async ({ lead, stage }: { lead: string; stage: string }) => {
      const [leadRecord, stageRecord] = await Promise.all([resolveLead(lead), resolveStage(stage)]);
      const maxOrder = await prisma.lead.aggregate({ where: { stageId: stageRecord.id }, _max: { order: true } });
      await prisma.lead.update({
        where: { id: leadRecord.id },
        data: { stageId: stageRecord.id, order: (maxOrder._max.order ?? -1) + 1 },
      });
      await auditMcpWrite({
        summary: `Stage changed to "${stageRecord.name}" through PRMOTE MCP (ChatGPT).`,
        leadId: leadRecord.id,
      });
      return { id: leadRecord.id, companyName: leadRecord.companyName, stage: stageRecord.name, message: "Lead moved." };
    })
  );

  server.registerTool(
    "create_client",
    {
      title: "Create a client",
      description: "Create a new client directly (most clients come from converting a won lead in the app, but this creates one from scratch).",
      inputSchema: {
        companyName: name200,
        mainContactName: name200,
        email: z.string().email().optional(),
        phone: optionalText(50),
        instagram: optionalText(100),
        website: optionalText(300),
        monthlyRetainer: z.number().min(0).max(1_000_000).optional(),
        oneOffValue: z.number().min(0).max(1_000_000).optional(),
        status: clientStatusEnum.optional(),
        paymentStatus: clientPaymentStatusEnum.optional(),
        notes: optionalText(5000),
      },
    },
    safeTool(async (args: {
      companyName: string;
      mainContactName: string;
      email?: string;
      phone?: string;
      instagram?: string;
      website?: string;
      monthlyRetainer?: number;
      oneOffValue?: number;
      status?: string;
      paymentStatus?: string;
      notes?: string;
    }) => {
      const client = await prisma.client.create({ data: args });
      await auditMcpWrite({ summary: "Client created through PRMOTE MCP (ChatGPT).", clientId: client.id });
      return { id: client.id, companyName: client.companyName, message: "Client created." };
    })
  );

  server.registerTool(
    "update_client",
    {
      title: "Update a client",
      description: "Update a client's details.",
      inputSchema: {
        client: z.string().describe("Client id or company name"),
        companyName: name200.optional(),
        mainContactName: name200.optional(),
        email: z.string().email().optional(),
        phone: optionalText(50),
        instagram: optionalText(100),
        website: optionalText(300),
        monthlyRetainer: z.number().min(0).max(1_000_000).optional(),
        oneOffValue: z.number().min(0).max(1_000_000).optional(),
        status: clientStatusEnum.optional(),
        paymentStatus: clientPaymentStatusEnum.optional(),
        notes: optionalText(5000),
      },
    },
    safeTool(async ({ client, ...fields }: { client: string } & Record<string, string | number | undefined>) => {
      const record = await resolveClient(client);
      const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(data).length === 0) throw new McpToolError("No fields to update were provided.");
      const updated = await prisma.client.update({ where: { id: record.id }, data });
      await auditMcpWrite({ summary: "Client updated through PRMOTE MCP (ChatGPT).", clientId: record.id });
      return { id: updated.id, companyName: updated.companyName, message: "Client updated." };
    })
  );

  server.registerTool(
    "add_lead_note",
    {
      title: "Add a note to a lead",
      description: 'Add a note to a lead, e.g. "Add a note to ABC Fitness saying they want a Q4 shoot."',
      inputSchema: { lead: z.string().describe("Lead id or company name"), note: z.string().min(1).max(5000) },
    },
    safeTool(async ({ lead, note }: { lead: string; note: string }) => {
      const record = await resolveLead(lead);
      const activity = await createActivityRecord({ type: "NOTE", notes: note, leadId: record.id });
      return { id: activity.id, lead: record.companyName, message: "Note added." };
    })
  );

  server.registerTool(
    "add_client_note",
    {
      title: "Add a note to a client",
      description: 'Add a note to a client, e.g. "Add a note to NP Coaches."',
      inputSchema: { client: z.string().describe("Client id or company name"), note: z.string().min(1).max(5000) },
    },
    safeTool(async ({ client, note }: { client: string; note: string }) => {
      const record = await resolveClient(client);
      const activity = await createActivityRecord({ type: "NOTE", notes: note, clientId: record.id });
      return { id: activity.id, client: record.companyName, message: "Note added." };
    })
  );

  server.registerTool(
    "create_task",
    {
      title: "Create a follow-up task",
      description:
        'Create a scheduled follow-up task against a lead or a client (exactly one of the two must be given), e.g. "Create a follow-up task for Friday."',
      inputSchema: {
        subject: z.string().min(1).max(300),
        dueAt: z.string().describe("ISO 8601 date/time the task is due, e.g. 2026-08-15T09:00:00Z"),
        notes: optionalText(5000),
        lead: z.string().optional().describe("Lead id or company name"),
        client: z.string().optional().describe("Client id or company name"),
      },
    },
    safeTool(async ({ subject, dueAt, notes, lead, client }: { subject: string; dueAt: string; notes?: string; lead?: string; client?: string }) => {
      if (!lead && !client) throw new McpToolError("Provide either a lead or a client for this task.");
      if (lead && client) throw new McpToolError("Provide only one of lead or client, not both.");
      const leadRecord = lead ? await resolveLead(lead) : undefined;
      const clientRecord = client ? await resolveClient(client) : undefined;
      const due = toDate(dueAt);
      const activity = await createActivityRecord({
        type: "FOLLOW_UP",
        subject,
        notes,
        dueAt: due,
        leadId: leadRecord?.id,
        clientId: clientRecord?.id,
      });
      return {
        id: activity.id,
        subject,
        dueAt: activity.dueAt,
        relatedTo: leadRecord?.companyName ?? clientRecord?.companyName,
        message: "Task created.",
      };
    })
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      description: "Update a task's subject, due date, or notes.",
      inputSchema: {
        task: z.string().describe("Task id, as returned by get_tasks / get_overdue_tasks / create_task"),
        subject: z.string().min(1).max(300).optional(),
        dueAt: z.string().optional().describe("ISO 8601 date/time"),
        notes: optionalText(5000),
      },
    },
    safeTool(async ({ task, subject, dueAt, notes }: { task: string; subject?: string; dueAt?: string; notes?: string }) => {
      const record = await resolveTask(task);
      const data: Record<string, unknown> = {};
      if (subject !== undefined) data.subject = subject;
      if (notes !== undefined) data.notes = notes;
      if (dueAt !== undefined) data.dueAt = toDate(dueAt);
      if (Object.keys(data).length === 0) throw new McpToolError("No fields to update were provided.");
      const updated = await prisma.activity.update({ where: { id: record.id }, data });
      return { id: updated.id, subject: updated.subject, dueAt: updated.dueAt, message: "Task updated." };
    })
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description: "Mark a task as completed.",
      inputSchema: { task: z.string().describe("Task id, as returned by get_tasks / get_overdue_tasks / create_task") },
    },
    safeTool(async ({ task }: { task: string }) => {
      const record = await resolveTask(task);
      const updated = await prisma.activity.update({ where: { id: record.id }, data: { completedAt: new Date() } });
      return { id: updated.id, subject: updated.subject, completedAt: updated.completedAt, message: "Task completed." };
    })
  );

  server.registerTool(
    "log_activity",
    {
      title: "Log an activity",
      description:
        "Log a general activity (call, email, meeting, DM, proposal sent, etc.) against a lead or client — exactly one of the two must be given.",
      inputSchema: {
        type: activityTypeEnum.describe("CALL | EMAIL | INSTAGRAM_DM | WHATSAPP | MEETING | PROPOSAL | FOLLOW_UP | NOTE"),
        subject: optionalText(300),
        notes: optionalText(5000),
        dueAt: z.string().optional().describe("ISO 8601 date/time, only if this activity needs a follow-up date"),
        lead: z.string().optional().describe("Lead id or company name"),
        client: z.string().optional().describe("Client id or company name"),
      },
    },
    safeTool(async ({ type, subject, notes, dueAt, lead, client }: { type: string; subject?: string; notes?: string; dueAt?: string; lead?: string; client?: string }) => {
      if (!lead && !client) throw new McpToolError("Provide either a lead or a client for this activity.");
      if (lead && client) throw new McpToolError("Provide only one of lead or client, not both.");
      const leadRecord = lead ? await resolveLead(lead) : undefined;
      const clientRecord = client ? await resolveClient(client) : undefined;
      const activity = await createActivityRecord({
        type,
        subject,
        notes,
        dueAt: toDate(dueAt),
        leadId: leadRecord?.id,
        clientId: clientRecord?.id,
      });
      return {
        id: activity.id,
        type: activity.type,
        relatedTo: leadRecord?.companyName ?? clientRecord?.companyName,
        message: "Activity logged.",
      };
    })
  );
}
