import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

// Accepts both a raw date-input string (first parse, client-side via
// zodResolver) and an already-parsed Date (re-parse on the server, since the
// client passes the zodResolver's *output* into the server action).
const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    return v.trim().length > 0 ? new Date(v) : undefined;
  });

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  });

export const leadSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email: optionalString,
  phone: optionalString,
  instagram: optionalString,
  website: optionalString,
  industry: optionalString,
  location: optionalString,
  source: optionalString,
  estimatedValue: optionalNumber,
  notes: optionalString,
  lastContactedAt: optionalDate,
  nextFollowUpAt: optionalDate,
  assignedToId: optionalString,
  stageId: z.string().min(1),
  serviceIds: z.array(z.string()).optional().default([]),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const clientSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  mainContactName: z.string().min(1, "Main contact is required"),
  email: optionalString,
  phone: optionalString,
  instagram: optionalString,
  website: optionalString,
  monthlyRetainer: optionalNumber,
  contractStart: optionalDate,
  contractEnd: optionalDate,
  paymentStatus: z.string().default("CURRENT"),
  status: z.string().default("ACTIVE"),
  color: z.string().default("#6366f1"),
  notes: optionalString,
  serviceIds: z.array(z.string()).optional().default([]),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().min(1, "Client is required"),
  shootDate: optionalDate,
  shootTime: optionalString,
  shootLocation: optionalString,
  projectType: optionalString,
  videographerId: optionalString,
  photographerId: optionalString,
  editorId: optionalString,
  status: z.string().default("PLANNING"),
  deadline: optionalDate,
  internalNotes: optionalString,
  clientNotes: optionalString,
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const deliverableSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  projectId: optionalString,
  contentType: z.string().min(1),
  customTypeName: optionalString,
  assignedEditorId: optionalString,
  statusId: z.string().min(1),
  deadline: optionalDate,
  revisionCount: optionalNumber,
  approvalStatus: z.string().default("PENDING"),
  deliveryLink: optionalString,
  notes: optionalString,
});
export type DeliverableInput = z.infer<typeof deliverableSchema>;

export const retainerSchema = z.object({
  clientId: z.string().min(1),
  monthlyRetainer: optionalNumber,
  shootsIncluded: optionalNumber,
  videosIncluded: optionalNumber,
  photosIncluded: optionalNumber,
  shootsUsed: optionalNumber,
  videosUsed: optionalNumber,
  photosUsed: optionalNumber,
  nextShootDate: optionalDate,
  nextPaymentDate: optionalDate,
  renewalDate: optionalDate,
  servicesIncludedText: optionalString,
});
export type RetainerInput = z.infer<typeof retainerSchema>;

export const invoiceSchema = z.object({
  clientId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  type: z.string().default("ONE_OFF"),
  status: z.string().default("DRAFT"),
  issueDate: optionalDate,
  dueDate: optionalDate,
  paidDate: optionalDate,
  description: optionalString,
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const activitySchema = z.object({
  type: z.string().min(1),
  subject: optionalString,
  notes: optionalString,
  dueAt: optionalDate,
  completedAt: optionalDate,
  leadId: optionalString,
  clientId: optionalString,
  createdById: optionalString,
});
export type ActivityInput = z.infer<typeof activitySchema>;
