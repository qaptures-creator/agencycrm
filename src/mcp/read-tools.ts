import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import { safeTool } from "@/mcp/response";
import { resolveClient, resolveLead } from "@/mcp/resolve";
import {
  clientStatusEnum,
  invoiceStatusEnum,
  projectStatusEnum,
  deliverableContentTypeEnum,
} from "@/mcp/schema-enums";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const limitSchema = z.number().int().min(1).max(MAX_LIMIT).optional();

function clamp(limit: number | undefined) {
  return Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
}

export function registerReadTools(server: McpServer) {
  server.registerTool(
    "get_clients",
    {
      title: "Get clients",
      description:
        "List CRM clients, optionally filtered by status. Returns company name, contact, status, payment status, monthly retainer, services and project/deliverable/invoice counts.",
      inputSchema: {
        status: clientStatusEnum.optional().describe("ACTIVE | PAUSED | CHURNED"),
        limit: limitSchema,
      },
    },
    safeTool(async ({ status, limit }: { status?: string; limit?: number }) => {
      const clients = await prisma.client.findMany({
        where: status ? { status } : undefined,
        include: {
          services: { select: { name: true } },
          _count: { select: { projects: true, deliverables: true, invoices: true } },
        },
        orderBy: { companyName: "asc" },
        take: clamp(limit),
      });
      return clients.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        mainContactName: c.mainContactName,
        email: c.email,
        phone: c.phone,
        status: c.status,
        paymentStatus: c.paymentStatus,
        monthlyRetainer: c.monthlyRetainer,
        oneOffValue: c.oneOffValue,
        services: c.services.map((s) => s.name),
        projectCount: c._count.projects,
        deliverableCount: c._count.deliverables,
        invoiceCount: c._count.invoices,
      }));
    })
  );

  server.registerTool(
    "get_client",
    {
      title: "Get a single client",
      description:
        "Get full detail for one client by id or company name, including retainer, recent projects, recent deliverables and recent activity.",
      inputSchema: { client: z.string().describe("Client id or company name, e.g. \"NP Coaches\"") },
    },
    safeTool(async ({ client }: { client: string }) => {
      const record = await resolveClient(client);
      const [projects, deliverables, invoices, activities, retainer] = await Promise.all([
        prisma.project.findMany({
          where: { clientId: record.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, name: true, status: true, shootDate: true, deadline: true },
        }),
        prisma.deliverable.findMany({
          where: { clientId: record.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { status: { select: { name: true } } },
        }),
        prisma.invoice.findMany({
          where: { clientId: record.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, amount: true, status: true, dueDate: true },
        }),
        prisma.activity.findMany({
          where: { clientId: record.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, subject: true, notes: true, createdAt: true, dueAt: true, completedAt: true },
        }),
        prisma.retainer.findUnique({ where: { clientId: record.id } }),
      ]);
      return {
        id: record.id,
        companyName: record.companyName,
        mainContactName: record.mainContactName,
        email: record.email,
        phone: record.phone,
        instagram: record.instagram,
        website: record.website,
        status: record.status,
        paymentStatus: record.paymentStatus,
        monthlyRetainer: record.monthlyRetainer,
        oneOffValue: record.oneOffValue,
        contractStart: record.contractStart,
        contractEnd: record.contractEnd,
        notes: record.notes,
        retainer,
        recentProjects: projects,
        recentDeliverables: deliverables.map((d) => ({
          id: d.id,
          contentType: d.customTypeName || d.contentType,
          status: d.status.name,
          deadline: d.deadline,
        })),
        recentInvoices: invoices,
        recentActivity: activities,
      };
    })
  );

  server.registerTool(
    "search_clients",
    {
      title: "Search clients",
      description: "Free-text search for clients by company name or contact name.",
      inputSchema: { query: z.string().min(1).max(200), limit: limitSchema },
    },
    safeTool(async ({ query, limit }: { query: string; limit?: number }) => {
      const clients = await prisma.client.findMany({
        where: {
          OR: [
            { companyName: { contains: query, mode: "insensitive" } },
            { mainContactName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: clamp(limit),
        select: { id: true, companyName: true, mainContactName: true, email: true, status: true },
      });
      return clients;
    })
  );

  server.registerTool(
    "get_leads",
    {
      title: "Get leads",
      description: "List leads in the pipeline, optionally filtered by pipeline stage name.",
      inputSchema: {
        stage: z.string().optional().describe("Pipeline stage name, e.g. \"Proposal Sent\""),
        limit: limitSchema,
      },
    },
    safeTool(async ({ stage, limit }: { stage?: string; limit?: number }) => {
      const leads = await prisma.lead.findMany({
        where: stage ? { stage: { name: { equals: stage, mode: "insensitive" } } } : undefined,
        include: { stage: { select: { name: true, isWon: true, isLost: true } }, assignedTo: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: clamp(limit),
      });
      return leads.map(shapeLead);
    })
  );

  server.registerTool(
    "get_lead",
    {
      title: "Get a single lead",
      description: "Get full detail for one lead by id or company name, including recent activity.",
      inputSchema: { lead: z.string().describe("Lead id or company name") },
    },
    safeTool(async ({ lead }: { lead: string }) => {
      const record = await resolveLead(lead);
      const [full, activities] = await Promise.all([
        prisma.lead.findUniqueOrThrow({
          where: { id: record.id },
          include: { stage: { select: { name: true, isWon: true, isLost: true } }, assignedTo: { select: { name: true } }, services: { select: { name: true } } },
        }),
        prisma.activity.findMany({
          where: { leadId: record.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, type: true, subject: true, notes: true, createdAt: true, dueAt: true, completedAt: true },
        }),
      ]);
      return { ...shapeLead(full), notes: full.notes, recentActivity: activities };
    })
  );

  server.registerTool(
    "search_leads",
    {
      title: "Search leads",
      description: "Free-text search for leads by company name or contact name.",
      inputSchema: { query: z.string().min(1).max(200), limit: limitSchema },
    },
    safeTool(async ({ query, limit }: { query: string; limit?: number }) => {
      const leads = await prisma.lead.findMany({
        where: {
          OR: [
            { companyName: { contains: query, mode: "insensitive" } },
            { contactName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { stage: { select: { name: true } } },
        take: clamp(limit),
      });
      return leads.map((l) => ({ id: l.id, companyName: l.companyName, contactName: l.contactName, stage: l.stage.name }));
    })
  );

  server.registerTool(
    "get_leads_by_stage",
    {
      title: "Get leads by stage",
      description: "List every lead currently sitting in a given pipeline stage, ordered by board position.",
      inputSchema: { stage: z.string().describe("Pipeline stage name, e.g. \"Discovery Call\"") },
    },
    safeTool(async ({ stage }: { stage: string }) => {
      const leads = await prisma.lead.findMany({
        where: { stage: { name: { equals: stage, mode: "insensitive" } } },
        include: { stage: { select: { name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { order: "asc" },
      });
      if (leads.length === 0) {
        const stages = await prisma.pipelineStage.findMany({ select: { name: true }, orderBy: { order: "asc" } });
        return { leads: [], availableStages: stages.map((s) => s.name) };
      }
      return leads.map(shapeLead);
    })
  );

  server.registerTool(
    "get_leads_needing_followup",
    {
      title: "Get leads needing follow-up",
      description: "Leads whose next-follow-up date is today or in the past (and not yet won/lost), ordered most-overdue first.",
      inputSchema: { limit: limitSchema },
    },
    safeTool(async ({ limit }: { limit?: number }) => {
      const leads = await prisma.lead.findMany({
        where: {
          nextFollowUpAt: { lte: new Date() },
          stage: { isWon: false, isLost: false },
        },
        include: { stage: { select: { name: true } }, assignedTo: { select: { name: true } } },
        orderBy: { nextFollowUpAt: "asc" },
        take: clamp(limit),
      });
      return leads.map(shapeLead);
    })
  );

  server.registerTool(
    "get_tasks",
    {
      title: "Get tasks / follow-ups",
      description:
        "List scheduled tasks (activities with a due date) across leads and clients. Set includeCompleted to also return completed ones.",
      inputSchema: { includeCompleted: z.boolean().optional().default(false), limit: limitSchema },
    },
    safeTool(async ({ includeCompleted, limit }: { includeCompleted?: boolean; limit?: number }) => {
      const tasks = await prisma.activity.findMany({
        where: { dueAt: { not: null }, ...(includeCompleted ? {} : { completedAt: null }) },
        include: { lead: { select: { companyName: true } }, client: { select: { companyName: true } } },
        orderBy: { dueAt: "asc" },
        take: clamp(limit),
      });
      return tasks.map(shapeTask);
    })
  );

  server.registerTool(
    "get_overdue_tasks",
    {
      title: "Get overdue tasks",
      description: "Tasks (activities with a due date) that are past due and not yet completed.",
      inputSchema: { limit: limitSchema },
    },
    safeTool(async ({ limit }: { limit?: number }) => {
      const tasks = await prisma.activity.findMany({
        where: { dueAt: { lt: new Date() }, completedAt: null },
        include: { lead: { select: { companyName: true } }, client: { select: { companyName: true } } },
        orderBy: { dueAt: "asc" },
        take: clamp(limit),
      });
      return tasks.map(shapeTask);
    })
  );

  server.registerTool(
    "get_invoices",
    {
      title: "Get invoices",
      description: "List invoices, optionally filtered by status and/or client.",
      inputSchema: {
        status: invoiceStatusEnum.optional().describe("DRAFT | SENT | DUE | PAID | OVERDUE"),
        client: z.string().optional().describe("Client id or company name"),
        limit: limitSchema,
      },
    },
    safeTool(async ({ status, client, limit }: { status?: string; client?: string; limit?: number }) => {
      const clientId = client ? (await resolveClient(client)).id : undefined;
      const invoices = await prisma.invoice.findMany({
        where: { ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
        include: { client: { select: { companyName: true } } },
        orderBy: { dueDate: "asc" },
        take: clamp(limit),
      });
      return invoices.map(shapeInvoice);
    })
  );

  server.registerTool(
    "get_overdue_invoices",
    {
      title: "Get overdue invoices",
      description: "Invoices that are unpaid and past their due date (or already marked OVERDUE).",
      inputSchema: { limit: limitSchema },
    },
    safeTool(async ({ limit }: { limit?: number }) => {
      const invoices = await prisma.invoice.findMany({
        where: {
          OR: [{ status: "OVERDUE" }, { status: { notIn: ["PAID", "DRAFT"] }, dueDate: { lt: new Date() } }],
        },
        include: { client: { select: { companyName: true } } },
        orderBy: { dueDate: "asc" },
        take: clamp(limit),
      });
      return invoices.map(shapeInvoice);
    })
  );

  server.registerTool(
    "get_projects",
    {
      title: "Get projects",
      description: "List projects/shoots, optionally filtered by status and/or client.",
      inputSchema: {
        status: projectStatusEnum.optional(),
        client: z.string().optional().describe("Client id or company name"),
        limit: limitSchema,
      },
    },
    safeTool(async ({ status, client, limit }: { status?: string; client?: string; limit?: number }) => {
      const clientId = client ? (await resolveClient(client)).id : undefined;
      const projects = await prisma.project.findMany({
        where: { ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
        include: { client: { select: { companyName: true } } },
        orderBy: { shootDate: "asc" },
        take: clamp(limit),
      });
      return projects.map(shapeProject);
    })
  );

  server.registerTool(
    "get_upcoming_projects",
    {
      title: "Get upcoming shoots",
      description: "Projects with a shoot date today or in the future, soonest first.",
      inputSchema: { limit: limitSchema },
    },
    safeTool(async ({ limit }: { limit?: number }) => {
      const projects = await prisma.project.findMany({
        where: { shootDate: { gte: new Date() } },
        include: { client: { select: { companyName: true } } },
        orderBy: { shootDate: "asc" },
        take: clamp(limit),
      });
      return projects.map(shapeProject);
    })
  );

  server.registerTool(
    "get_deliverables",
    {
      title: "Get deliverables",
      description: "List content deliverables, optionally filtered by content type and/or client.",
      inputSchema: {
        contentType: deliverableContentTypeEnum.optional(),
        client: z.string().optional().describe("Client id or company name"),
        limit: limitSchema,
      },
    },
    safeTool(async ({ contentType, client, limit }: { contentType?: string; client?: string; limit?: number }) => {
      const clientId = client ? (await resolveClient(client)).id : undefined;
      const deliverables = await prisma.deliverable.findMany({
        where: { ...(contentType ? { contentType } : {}), ...(clientId ? { clientId } : {}) },
        include: { client: { select: { companyName: true } }, status: { select: { name: true } } },
        orderBy: { deadline: "asc" },
        take: clamp(limit),
      });
      return deliverables.map((d) => ({
        id: d.id,
        client: d.client.companyName,
        contentType: d.customTypeName || d.contentType,
        status: d.status.name,
        approvalStatus: d.approvalStatus,
        deadline: d.deadline,
        deliveryLink: d.deliveryLink,
      }));
    })
  );

  server.registerTool(
    "get_recent_activity",
    {
      title: "Get recent activity",
      description: "The most recent activity log entries (calls, emails, notes, meetings, etc.) across all leads and clients.",
      inputSchema: { limit: limitSchema },
    },
    safeTool(async ({ limit }: { limit?: number }) => {
      const activities = await prisma.activity.findMany({
        include: { lead: { select: { companyName: true } }, client: { select: { companyName: true } }, createdBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: clamp(limit),
      });
      return activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        notes: a.notes,
        relatedTo: a.lead?.companyName ?? a.client?.companyName ?? null,
        createdBy: a.createdBy?.name ?? null,
        createdAt: a.createdAt,
      }));
    })
  );
}

function shapeLead(l: {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  estimatedValue: number | null;
  source: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  stage: { name: string; isWon?: boolean; isLost?: boolean };
  assignedTo: { name: string } | null;
}) {
  return {
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    instagram: l.instagram,
    website: l.website,
    stage: l.stage.name,
    estimatedValue: l.estimatedValue,
    source: l.source,
    assignedTo: l.assignedTo?.name ?? null,
    lastContactedAt: l.lastContactedAt,
    nextFollowUpAt: l.nextFollowUpAt,
  };
}

function shapeTask(t: {
  id: string;
  type: string;
  subject: string | null;
  notes: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  lead: { companyName: string } | null;
  client: { companyName: string } | null;
}) {
  return {
    id: t.id,
    type: t.type,
    subject: t.subject,
    notes: t.notes,
    relatedTo: t.lead?.companyName ?? t.client?.companyName ?? null,
    dueAt: t.dueAt,
    completed: Boolean(t.completedAt),
  };
}

function shapeInvoice(i: {
  id: string;
  amount: number;
  type: string;
  status: string;
  dueDate: Date | null;
  issueDate: Date | null;
  paidDate: Date | null;
  description: string | null;
  client: { companyName: string };
}) {
  return {
    id: i.id,
    client: i.client.companyName,
    amount: i.amount,
    type: i.type,
    status: i.status,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    paidDate: i.paidDate,
    description: i.description,
  };
}

function shapeProject(p: {
  id: string;
  name: string;
  status: string;
  shootDate: Date | null;
  shootLocation: string | null;
  deadline: Date | null;
  client: { companyName: string };
}) {
  return {
    id: p.id,
    name: p.name,
    client: p.client.companyName,
    status: p.status,
    shootDate: p.shootDate,
    shootLocation: p.shootLocation,
    deadline: p.deadline,
  };
}
