"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BusinessResult, CrmMatch } from "@/lib/business-finder-types";

const AUTO_NOTE = "Lead discovered through PRMOTE Business Finder.";

function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.match(/^https?:\/\//i) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length > 10) digits = `0${digits.slice(2)}`;
  return digits.length >= 9 ? digits : null;
}

const UK_POSTCODE_RE =
  /([Gg][Ii][Rr]\s?0[Aa]{2})|((([A-Za-z][0-9]{1,2})|([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))\s?[0-9][A-Za-z]{2})/;

function extractPostcode(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(UK_POSTCODE_RE);
  return match ? match[0].toUpperCase().replace(/\s+/g, " ").trim() : null;
}

type MatchInput = { placeId: string; website: string | null; phone: string | null; name: string; address: string | null };
type LeadRow = { id: string; companyName: string; website: string | null; phone: string | null; location: string | null; googlePlaceId: string | null };
type ClientRow = { id: string; companyName: string; website: string | null; phone: string | null };

function matchOne(b: MatchInput, leads: LeadRow[], clients: ClientRow[]): CrmMatch | null {
  // 1. Google Place ID — the only fully reliable signal.
  const leadByPlaceId = leads.find((l) => l.googlePlaceId && l.googlePlaceId === b.placeId);
  if (leadByPlaceId) return { type: "lead", id: leadByPlaceId.id, href: `/crm?lead=${leadByPlaceId.id}` };

  // 2. Website domain.
  const domain = normalizeDomain(b.website);
  if (domain) {
    const lead = leads.find((l) => normalizeDomain(l.website) === domain);
    if (lead) return { type: "lead", id: lead.id, href: `/crm?lead=${lead.id}` };
    const client = clients.find((c) => normalizeDomain(c.website) === domain);
    if (client) return { type: "client", id: client.id, href: `/clients/${client.id}` };
  }

  // 3. Phone number.
  const phone = normalizePhone(b.phone);
  if (phone) {
    const lead = leads.find((l) => normalizePhone(l.phone) === phone);
    if (lead) return { type: "lead", id: lead.id, href: `/crm?lead=${lead.id}` };
    const client = clients.find((c) => normalizePhone(c.phone) === phone);
    if (client) return { type: "client", id: client.id, href: `/clients/${client.id}` };
  }

  // 4. Business name + postcode (lowest confidence, last resort).
  const nameLower = b.name.trim().toLowerCase();
  const postcode = extractPostcode(b.address);
  const lead = leads.find(
    (l) =>
      l.companyName.trim().toLowerCase() === nameLower &&
      (!postcode || (l.location ?? "").toUpperCase().includes(postcode))
  );
  if (lead) return { type: "lead", id: lead.id, href: `/crm?lead=${lead.id}` };
  const client = clients.find((c) => c.companyName.trim().toLowerCase() === nameLower);
  if (client) return { type: "client", id: client.id, href: `/clients/${client.id}` };

  return null;
}

/** Batched duplicate check — one query for the whole result page, not one per card. */
export async function findCrmMatches(businesses: MatchInput[]): Promise<Map<string, CrmMatch>> {
  const result = new Map<string, CrmMatch>();
  if (businesses.length === 0) return result;

  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      select: { id: true, companyName: true, website: true, phone: true, location: true, googlePlaceId: true },
    }),
    prisma.client.findMany({ select: { id: true, companyName: true, website: true, phone: true } }),
  ]);

  for (const b of businesses) {
    const match = matchOne(b, leads, clients);
    if (match) result.set(b.placeId, match);
  }
  return result;
}

function toMatchInput(b: BusinessResult): MatchInput {
  return { placeId: b.placeId, website: b.website, phone: b.phone, name: b.name, address: b.address };
}

async function createLeadFromBusiness(business: BusinessResult, stageId: string, order: number) {
  const lead = await prisma.lead.create({
    data: {
      companyName: business.name,
      // Google doesn't give us a named contact — the business name is the
      // most honest placeholder for a required field; editable afterwards.
      contactName: business.name,
      phone: business.phone ?? undefined,
      website: business.website ?? undefined,
      instagram: business.instagram?.url ?? undefined,
      location: business.address ?? undefined,
      industry: business.category ?? undefined,
      source: "Business Finder",
      notes: AUTO_NOTE,
      googlePlaceId: business.placeId,
      stageId,
      order,
    },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE",
      subject: "Business Finder",
      notes:
        AUTO_NOTE +
        (business.rating != null || business.reviewCount != null
          ? ` Google: ${business.rating ?? "no rating"}${business.reviewCount != null ? ` (${business.reviewCount} reviews)` : ""}.`
          : ""),
      leadId: lead.id,
    },
  });

  return lead;
}

async function getDefaultStageOrThrow() {
  const stage = await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } });
  if (!stage) throw new Error("No pipeline stages exist yet — set one up in Settings first.");
  return stage;
}

export type AddLeadOutcome =
  | { status: "created"; businessName: string; leadId: string }
  | { status: "duplicate"; businessName: string; match: CrmMatch };

export async function addBusinessToLead(business: BusinessResult): Promise<AddLeadOutcome> {
  const matches = await findCrmMatches([toMatchInput(business)]);
  const existing = matches.get(business.placeId);
  if (existing) return { status: "duplicate", businessName: business.name, match: existing };

  const stage = await getDefaultStageOrThrow();
  const maxOrder = await prisma.lead.aggregate({ where: { stageId: stage.id }, _max: { order: true } });

  try {
    const lead = await createLeadFromBusiness(business, stage.id, (maxOrder._max.order ?? -1) + 1);
    revalidatePath("/crm");
    revalidatePath("/");
    return { status: "created", businessName: business.name, leadId: lead.id };
  } catch (err) {
    // Unique constraint on googlePlaceId — someone else added it a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existingLead = await prisma.lead.findUnique({ where: { googlePlaceId: business.placeId } });
      if (existingLead) {
        return { status: "duplicate", businessName: business.name, match: { type: "lead", id: existingLead.id, href: `/crm?lead=${existingLead.id}` } };
      }
    }
    throw err;
  }
}

export type BulkAddResult = { added: number; alreadyExisted: number; failed: number; leadIds: string[] };

export async function addBusinessesToLead(businesses: BusinessResult[]): Promise<BulkAddResult> {
  const result: BulkAddResult = { added: 0, alreadyExisted: 0, failed: 0, leadIds: [] };
  if (businesses.length === 0) return result;

  const matches = await findCrmMatches(businesses.map(toMatchInput));
  const stage = await getDefaultStageOrThrow();
  const maxOrder = await prisma.lead.aggregate({ where: { stageId: stage.id }, _max: { order: true } });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  for (const business of businesses) {
    if (matches.has(business.placeId)) {
      result.alreadyExisted += 1;
      continue;
    }
    try {
      const lead = await createLeadFromBusiness(business, stage.id, nextOrder++);
      result.added += 1;
      result.leadIds.push(lead.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        result.alreadyExisted += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  if (result.added > 0) {
    revalidatePath("/crm");
    revalidatePath("/");
  }
  return result;
}
