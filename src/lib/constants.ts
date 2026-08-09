// Shared vocab for string-backed "enum" fields (SQLite has no native enum type).
// Each export pairs a value union with display metadata used across the UI.

export type ActivityType =
  | "CALL"
  | "EMAIL"
  | "INSTAGRAM_DM"
  | "WHATSAPP"
  | "MEETING"
  | "PROPOSAL"
  | "FOLLOW_UP"
  | "NOTE";

export const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: "CALL", label: "Call", icon: "Phone" },
  { value: "EMAIL", label: "Email", icon: "Mail" },
  { value: "INSTAGRAM_DM", label: "Instagram DM", icon: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp", icon: "MessageCircle" },
  { value: "MEETING", label: "Meeting", icon: "Users" },
  { value: "PROPOSAL", label: "Proposal", icon: "FileText" },
  { value: "FOLLOW_UP", label: "Follow-up", icon: "Clock" },
  { value: "NOTE", label: "Note", icon: "StickyNote" },
];

export type ProjectStatus =
  | "PLANNING"
  | "SHOOT_BOOKED"
  | "FILMING_COMPLETE"
  | "EDITING"
  | "INTERNAL_REVIEW"
  | "CLIENT_REVIEW"
  | "REVISIONS"
  | "APPROVED"
  | "DELIVERED";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "PLANNING", label: "Planning", color: "#64748b" },
  { value: "SHOOT_BOOKED", label: "Shoot Booked", color: "#6366f1" },
  { value: "FILMING_COMPLETE", label: "Filming Complete", color: "#8b5cf6" },
  { value: "EDITING", label: "Editing", color: "#a855f7" },
  { value: "INTERNAL_REVIEW", label: "Internal Review", color: "#d946ef" },
  { value: "CLIENT_REVIEW", label: "Client Review", color: "#f59e0b" },
  { value: "REVISIONS", label: "Revisions", color: "#ef4444" },
  { value: "APPROVED", label: "Approved", color: "#22c55e" },
  { value: "DELIVERED", label: "Delivered", color: "#10b981" },
];

export type DeliverableContentType =
  | "REEL"
  | "TIKTOK"
  | "YOUTUBE_VIDEO"
  | "PHOTOGRAPHY"
  | "AD_CREATIVE"
  | "SOCIAL_POST"
  | "OTHER";

export const DELIVERABLE_CONTENT_TYPES: { value: DeliverableContentType; label: string }[] = [
  { value: "REEL", label: "Reel" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE_VIDEO", label: "YouTube Video" },
  { value: "PHOTOGRAPHY", label: "Photography" },
  { value: "AD_CREATIVE", label: "Ad Creative" },
  { value: "SOCIAL_POST", label: "Social Post" },
  { value: "OTHER", label: "Other" },
];

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVISIONS_REQUESTED";

export const APPROVAL_STATUSES: { value: ApprovalStatus; label: string; color: string }[] = [
  { value: "PENDING", label: "Pending", color: "#f59e0b" },
  { value: "APPROVED", label: "Approved", color: "#22c55e" },
  { value: "REJECTED", label: "Rejected", color: "#ef4444" },
  { value: "REVISIONS_REQUESTED", label: "Revisions Requested", color: "#f97316" },
];

export type InvoiceStatus = "DRAFT" | "SENT" | "DUE" | "PAID" | "OVERDUE";

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; color: string }[] = [
  { value: "DRAFT", label: "Draft", color: "#64748b" },
  { value: "SENT", label: "Sent", color: "#6366f1" },
  { value: "DUE", label: "Due", color: "#f59e0b" },
  { value: "PAID", label: "Paid", color: "#22c55e" },
  { value: "OVERDUE", label: "Overdue", color: "#ef4444" },
];

export type InvoiceType = "RETAINER" | "ONE_OFF" | "PROJECT";

export const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
  { value: "RETAINER", label: "Monthly Retainer" },
  { value: "ONE_OFF", label: "One-off Project" },
  { value: "PROJECT", label: "Project Milestone" },
];

export type ClientStatus = "ACTIVE" | "PAUSED" | "CHURNED";

export const CLIENT_STATUSES: { value: ClientStatus; label: string; color: string }[] = [
  { value: "ACTIVE", label: "Active", color: "#22c55e" },
  { value: "PAUSED", label: "Paused", color: "#f59e0b" },
  { value: "CHURNED", label: "Churned", color: "#ef4444" },
];

export type ClientPaymentStatus = "CURRENT" | "OVERDUE" | "PAUSED";

export const CLIENT_PAYMENT_STATUSES: { value: ClientPaymentStatus; label: string; color: string }[] = [
  { value: "CURRENT", label: "Current", color: "#22c55e" },
  { value: "OVERDUE", label: "Overdue", color: "#ef4444" },
  { value: "PAUSED", label: "Paused", color: "#f59e0b" },
];

export const LEAD_SOURCES = [
  "Referral",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "Website",
  "Cold Outreach",
  "Google Search",
  "Networking Event",
  "Past Client",
  "Other",
];

export const PROJECT_TYPES = [
  "Brand Video",
  "Social Content",
  "Commercial / Ad",
  "Product Photography",
  "Event Coverage",
  "Documentary",
  "Podcast",
  "Music Video",
  "Corporate / Training",
  "Other",
];

export const DEFAULT_PIPELINE_STAGES = [
  { name: "New Lead", color: "#6366f1", isWon: false, isLost: false },
  { name: "Contacted", color: "#8b5cf6", isWon: false, isLost: false },
  { name: "Replied", color: "#a855f7", isWon: false, isLost: false },
  { name: "Discovery Call", color: "#d946ef", isWon: false, isLost: false },
  { name: "Proposal Sent", color: "#f59e0b", isWon: false, isLost: false },
  { name: "Negotiating", color: "#f97316", isWon: false, isLost: false },
  { name: "Won", color: "#22c55e", isWon: true, isLost: false },
  { name: "Lost", color: "#ef4444", isWon: false, isLost: true },
];

export const DEFAULT_DELIVERABLE_STATUSES = [
  { name: "Not Started", color: "#64748b", isTerminal: false },
  { name: "In Progress", color: "#6366f1", isTerminal: false },
  { name: "Editor Review", color: "#a855f7", isTerminal: false },
  { name: "Client Review", color: "#f59e0b", isTerminal: false },
  { name: "Revisions", color: "#ef4444", isTerminal: false },
  { name: "Approved", color: "#22c55e", isTerminal: false },
  { name: "Delivered", color: "#10b981", isTerminal: true },
];

export function labelFor<T extends { value: string; label: string }>(
  list: T[],
  value: string | null | undefined
): string {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function colorFor<T extends { value: string; color: string }>(
  list: T[],
  value: string | null | undefined,
  fallback = "#64748b"
): string {
  return list.find((i) => i.value === value)?.color ?? fallback;
}
