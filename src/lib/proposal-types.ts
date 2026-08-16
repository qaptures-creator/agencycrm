import { z } from "zod";

// ---------------------------------------------------------------------------
// Proposal content — a small set of typed, full-page sections. Each section
// renders as one page in the document (or one slide in a deck) and is shared
// verbatim between the in-app viewer and the PDF export, so editing content
// here is the single source of truth for both.
// ---------------------------------------------------------------------------

export const PROPOSAL_LAYOUTS = [
  { value: "DOCUMENT", label: "Document (A4 portrait)" },
  { value: "DECK", label: "Deck (A4 landscape)" },
] as const;

export type ProposalLayout = (typeof PROPOSAL_LAYOUTS)[number]["value"];

export const proposalSectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("COVER"),
    heading: z.string().default(""),
    subheading: z.string().default(""),
    date: z.string().default(""),
  }),
  z.object({
    id: z.string(),
    type: z.literal("TEXT"),
    heading: z.string().default(""),
    body: z.string().default(""),
  }),
  z.object({
    id: z.string(),
    type: z.literal("SERVICES"),
    heading: z.string().default(""),
    items: z.array(z.string()).default([]),
  }),
  z.object({
    id: z.string(),
    type: z.literal("PRICING"),
    heading: z.string().default(""),
    items: z
      .array(z.object({ label: z.string().default(""), price: z.string().default(""), note: z.string().default("") }))
      .default([]),
    total: z.string().default(""),
  }),
  z.object({
    id: z.string(),
    type: z.literal("TIMELINE"),
    heading: z.string().default(""),
    steps: z.array(z.object({ title: z.string().default(""), detail: z.string().default("") })).default([]),
  }),
  z.object({
    id: z.string(),
    type: z.literal("CLOSING"),
    heading: z.string().default(""),
    body: z.string().default(""),
    contactName: z.string().default(""),
    contactEmail: z.string().default(""),
  }),
]);

export type ProposalSection = z.infer<typeof proposalSectionSchema>;
export type ProposalSectionType = ProposalSection["type"];

export const proposalContentSchema = z.object({
  sections: z.array(proposalSectionSchema).min(1, "Add at least one section"),
});

export type ProposalContent = z.infer<typeof proposalContentSchema>;

export const proposalSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  layout: z.enum(["DOCUMENT", "DECK"]).default("DOCUMENT"),
  content: proposalContentSchema,
});

export type ProposalInput = z.infer<typeof proposalSchema>;

export const SECTION_TYPE_META: Record<ProposalSectionType, { label: string; description: string }> = {
  COVER: { label: "Cover", description: "Title page with client name and date" },
  TEXT: { label: "Text", description: "Heading and a paragraph — overview, approach, about us" },
  SERVICES: { label: "Services", description: "Bullet list of what's included" },
  PRICING: { label: "Pricing", description: "Line items and a total investment" },
  TIMELINE: { label: "Timeline", description: "Ordered steps or milestones" },
  CLOSING: { label: "Closing", description: "Sign-off and contact details" },
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createSection(type: ProposalSectionType): ProposalSection {
  switch (type) {
    case "COVER":
      return { id: newId(), type, heading: "", subheading: "", date: "" };
    case "TEXT":
      return { id: newId(), type, heading: "", body: "" };
    case "SERVICES":
      return { id: newId(), type, heading: "What's included", items: [] };
    case "PRICING":
      return { id: newId(), type, heading: "Investment", items: [], total: "" };
    case "TIMELINE":
      return { id: newId(), type, heading: "Timeline", steps: [] };
    case "CLOSING":
      return { id: newId(), type, heading: "Next steps", body: "", contactName: "", contactEmail: "" };
  }
}

/** Seeds a sensible starting proposal from what we already know about the client. */
export function createDefaultProposalContent(client: {
  companyName: string;
  mainContactName: string;
  monthlyRetainer: number | null;
  oneOffValue: number | null;
  services: { name: string }[];
}): ProposalContent {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const priceLabel = client.monthlyRetainer
    ? `£${client.monthlyRetainer.toLocaleString("en-GB")}/mo`
    : client.oneOffValue
      ? `£${client.oneOffValue.toLocaleString("en-GB")}`
      : "";

  return {
    sections: [
      { id: newId(), type: "COVER", heading: `Proposal for ${client.companyName}`, subheading: "Prepared by PRMOTE", date: today },
      {
        id: newId(),
        type: "TEXT",
        heading: "Overview",
        body: `Thanks for the opportunity to work with ${client.companyName}. This proposal outlines the scope, timeline and investment for the work ahead.`,
      },
      {
        id: newId(),
        type: "SERVICES",
        heading: "What's included",
        items: client.services.length > 0 ? client.services.map((s) => s.name) : ["Content strategy", "Production", "Editing & delivery"],
      },
      {
        id: newId(),
        type: "PRICING",
        heading: "Investment",
        items: priceLabel ? [{ label: client.monthlyRetainer ? "Monthly retainer" : "Project fee", price: priceLabel, note: "" }] : [],
        total: priceLabel,
      },
      {
        id: newId(),
        type: "CLOSING",
        heading: "Next steps",
        body: "Let us know if you'd like to move forward and we'll get things scheduled in.",
        contactName: client.mainContactName,
        contactEmail: "",
      },
    ],
  };
}
