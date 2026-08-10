import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? new Date(v) : undefined));

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  });

const requiredNumber = z.union([z.string(), z.number()]).transform((v) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
});

export const staffSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: optionalString,
  phone: optionalString,
  position: z.string().min(1, "Position is required"),
  employmentStatus: z.string().default("Active"),
  startDate: optionalDate,
  endDate: optionalDate,
  typicalHours: optionalString,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  notes: optionalString,
  photoUrl: optionalString,
});
export type StaffInput = z.infer<typeof staffSchema>;

export const shiftSchema = z.object({
  staffId: z.string().min(1, "Staff member is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "Finish time is required"),
  breakMinutes: optionalNumber,
  shiftRole: optionalString,
  notes: optionalString,
});
export type ShiftInput = z.infer<typeof shiftSchema>;

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: optionalString,
  assignedToId: optionalString,
  dueDate: optionalDate,
  dueTime: optionalString,
  priority: z.string().default("NORMAL"),
  category: z.string().default("OTHER"),
  recurrence: z.string().default("ONE_OFF"),
  recurrenceDay: optionalString,
});
export type TaskInput = z.infer<typeof taskSchema>;

export const enquirySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: optionalString,
  phone: optionalString,
  subject: optionalString,
  category: z.string().default("OTHER"),
  priority: z.string().default("NORMAL"),
  source: z.string().default("MANUAL"),
  assignedToId: optionalString,
  followUpAt: optionalDate,
  message: optionalString,
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: optionalString,
  phone: optionalString,
  source: z.string().default("OTHER"),
  membershipInterest: optionalString,
  assignedToId: optionalString,
  stage: z.string().default("NEW_LEAD"),
  nextFollowUpAt: optionalDate,
});
export type GymLeadInput = z.infer<typeof leadSchema>;

export const memberSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: optionalString,
  phone: optionalString,
  dob: optionalDate,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  address: optionalString,
  joinDate: optionalDate,
  notes: optionalString,
});
export type MemberInput = z.infer<typeof memberSchema>;

export const membershipPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  price: requiredNumber,
  billingFrequency: z.string().default("MONTHLY"),
  joiningFee: optionalNumber,
  contractLengthMonths: optionalNumber,
  description: optionalString,
});
export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>;

export const equipmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  manufacturer: optionalString,
  model: optionalString,
  category: z.string().default("OTHER"),
  serialNumber: optionalString,
  purchaseDate: optionalDate,
  condition: z.string().default("GOOD"),
  lastServiceDate: optionalDate,
  nextServiceDate: optionalDate,
  location: optionalString,
  notes: optionalString,
  photoUrl: optionalString,
});
export type EquipmentInput = z.infer<typeof equipmentSchema>;

export const maintenanceTicketSchema = z.object({
  issue: z.string().min(1, "Describe the issue"),
  area: optionalString,
  equipmentId: optionalString,
  priority: z.string().default("NORMAL"),
  assignedToId: optionalString,
  photoUrl: optionalString,
});
export type MaintenanceTicketInput = z.infer<typeof maintenanceTicketSchema>;

export const incidentSchema = z.object({
  occurredAt: z.string().min(1),
  category: z.string().default("OTHER"),
  location: optionalString,
  description: z.string().min(1, "Description is required"),
  actionTaken: optionalString,
  witnesses: optionalString,
  followUpRequired: z.boolean().default(false),
  followUpNotes: optionalString,
});
export type IncidentInput = z.infer<typeof incidentSchema>;

export const membershipSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  planId: z.string().min(1, "Plan is required"),
  startDate: optionalDate,
  renewalDate: optionalDate,
  billingAmount: requiredNumber,
  paymentFrequency: z.string().default("MONTHLY"),
  status: z.string().default("ACTIVE"),
  paymentStatus: z.string().default("CURRENT"),
});
export type MembershipInput = z.infer<typeof membershipSchema>;

export const paymentSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  transactionRef: optionalString,
  date: optionalDate,
  amount: requiredNumber,
  type: z.string().default("MEMBERSHIP"),
  status: z.string().default("PAID"),
  provider: z.string().default("MANUAL"),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const shakeBarProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().default("OTHER"),
  stock: optionalNumber,
  costPrice: optionalNumber,
  sellingPrice: optionalNumber,
  lowStockLevel: optionalNumber,
  supplier: optionalString,
});
export type ShakeBarProductInput = z.infer<typeof shakeBarProductSchema>;

export const marketingCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  type: z.string().default("OTHER"),
  status: z.string().default("ACTIVE"),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalString,
});
export type MarketingCampaignInput = z.infer<typeof marketingCampaignSchema>;

export const marketingContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  platform: z.string().default("INSTAGRAM"),
  shootDate: optionalDate,
  publishDate: optionalDate,
  status: z.string().default("IDEA"),
  notes: optionalString,
  ownerId: optionalString,
});
export type MarketingContentInput = z.infer<typeof marketingContentSchema>;

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  pinned: z.boolean().default(false),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const gymSettingsSchema = z.object({
  gymName: z.string().min(1, "Gym name is required"),
  address: optionalString,
  phone: optionalString,
  email: z.string().email("Enter a valid email"),
  website: optionalString,
});
export type GymSettingsInput = z.infer<typeof gymSettingsSchema>;
