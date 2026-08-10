// Shared vocab for the Gym CRM's string-backed "enum" fields.
// Mirrors the pattern in src/lib/constants.ts (Agency CRM).

type Opt<V extends string = string> = { value: V; label: string; color?: string };

export const TASK_PRIORITIES: Opt[] = [
  { value: "LOW", label: "Low", color: "#64748b" },
  { value: "NORMAL", label: "Normal", color: "#6366f1" },
  { value: "HIGH", label: "High", color: "#f59e0b" },
  { value: "URGENT", label: "Urgent", color: "#ef4444" },
];

export const TASK_CATEGORIES: Opt[] = [
  { value: "CLEANING", label: "Cleaning" },
  { value: "CUSTOMER_SERVICE", label: "Customer Service" },
  { value: "MEMBERSHIP", label: "Membership" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "SHAKE_BAR", label: "Shake Bar" },
  { value: "MARKETING", label: "Marketing" },
  { value: "ADMIN", label: "Admin" },
  { value: "HEALTH_SAFETY", label: "Health & Safety" },
  { value: "OTHER", label: "Other" },
];

export const TASK_STATUSES: Opt[] = [
  { value: "TODO", label: "To Do", color: "#64748b" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#6366f1" },
  { value: "COMPLETED", label: "Completed", color: "#22c55e" },
  { value: "OVERDUE", label: "Overdue", color: "#ef4444" },
];

export const TASK_RECURRENCE: Opt[] = [
  { value: "ONE_OFF", label: "One-Off" },
  { value: "DAILY", label: "Every Day" },
  { value: "WEEKLY", label: "Weekly" },
];

export const WEEKDAYS: Opt[] = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

export const STAFF_POSITIONS = [
  "Owner",
  "Manager",
  "Reception",
  "Gym Floor Staff",
  "Cleaner",
  "Shake Bar",
  "Marketing",
  "Coach / PT",
];

export const EMPLOYMENT_STATUSES: Opt[] = [
  { value: "Active", label: "Active", color: "#22c55e" },
  { value: "Part-Time", label: "Part-Time", color: "#6366f1" },
  { value: "Casual", label: "Casual", color: "#f59e0b" },
  { value: "Former", label: "Former", color: "#64748b" },
];

export const ENQUIRY_CATEGORIES: Opt[] = [
  { value: "MEMBERSHIP", label: "Membership" },
  { value: "DAY_PASS", label: "Day Pass" },
  { value: "GENERAL", label: "General Question" },
  { value: "CANCELLATION", label: "Cancellation" },
  { value: "PAYMENT", label: "Payment" },
  { value: "COMPLAINT", label: "Complaint" },
  { value: "PERSONAL_TRAINING", label: "Personal Training" },
  { value: "FACILITIES", label: "Facilities" },
  { value: "BUSINESS", label: "Business" },
  { value: "OTHER", label: "Other" },
];

export const ENQUIRY_STATUSES: Opt[] = [
  { value: "NEW", label: "New", color: "#6366f1" },
  { value: "REPLIED", label: "Replied", color: "#22c55e" },
  { value: "AWAITING_RESPONSE", label: "Awaiting Response", color: "#f59e0b" },
  { value: "FOLLOW_UP", label: "Follow-Up", color: "#a855f7" },
  { value: "CONVERTED", label: "Converted", color: "#10b981" },
  { value: "CLOSED", label: "Closed", color: "#64748b" },
];

export const ENQUIRY_SOURCES: Opt[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WEBSITE", label: "Website" },
  { value: "PHONE", label: "Phone" },
  { value: "WALK_IN", label: "Walk-In" },
  { value: "MANUAL", label: "Manual" },
];

export const LEAD_STAGES: Opt[] = [
  { value: "NEW_LEAD", label: "New Lead", color: "#6366f1" },
  { value: "CONTACTED", label: "Contacted", color: "#8b5cf6" },
  { value: "INTERESTED", label: "Interested", color: "#a855f7" },
  { value: "TOUR_BOOKED", label: "Tour Booked", color: "#d946ef" },
  { value: "TRIAL", label: "Trial / Day Pass", color: "#f59e0b" },
  { value: "FOLLOW_UP", label: "Follow-Up", color: "#f97316" },
  { value: "READY_TO_JOIN", label: "Ready to Join", color: "#22c55e" },
  { value: "JOINED", label: "Joined", color: "#10b981" },
  { value: "LOST", label: "Lost", color: "#ef4444" },
];

export const LEAD_SOURCES: Opt[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "GOOGLE", label: "Google" },
  { value: "WALK_IN", label: "Walk-In" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "REFERRAL", label: "Referral" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "OTHER", label: "Other" },
];

export const MEMBERSHIP_STATUSES: Opt[] = [
  { value: "ACTIVE", label: "Active", color: "#22c55e" },
  { value: "FROZEN", label: "Frozen", color: "#38bdf8" },
  { value: "CANCELLED", label: "Cancelled", color: "#ef4444" },
  { value: "EXPIRED", label: "Expired", color: "#64748b" },
  { value: "OVERDUE", label: "Overdue", color: "#f59e0b" },
];

export const PAYMENT_STATUSES: Opt[] = [
  { value: "CURRENT", label: "Current", color: "#22c55e" },
  { value: "OVERDUE", label: "Overdue", color: "#f59e0b" },
  { value: "FAILED", label: "Failed", color: "#ef4444" },
];

export const PAYMENT_TX_STATUSES: Opt[] = [
  { value: "PAID", label: "Paid", color: "#22c55e" },
  { value: "PENDING", label: "Pending", color: "#f59e0b" },
  { value: "FAILED", label: "Failed", color: "#ef4444" },
  { value: "REFUNDED", label: "Refunded", color: "#64748b" },
];

export const BILLING_FREQUENCIES: Opt[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

export const EQUIPMENT_CATEGORIES: Opt[] = [
  { value: "CHEST", label: "Chest" },
  { value: "BACK", label: "Back" },
  { value: "SHOULDERS", label: "Shoulders" },
  { value: "ARMS", label: "Arms" },
  { value: "LEGS", label: "Legs" },
  { value: "CARDIO", label: "Cardio" },
  { value: "FREE_WEIGHTS", label: "Free Weights" },
  { value: "OTHER", label: "Other" },
];

export const EQUIPMENT_CONDITIONS: Opt[] = [
  { value: "EXCELLENT", label: "Excellent", color: "#22c55e" },
  { value: "GOOD", label: "Good", color: "#6366f1" },
  { value: "NEEDS_ATTENTION", label: "Needs Attention", color: "#f59e0b" },
  { value: "OUT_OF_SERVICE", label: "Out of Service", color: "#ef4444" },
];

export const MAINTENANCE_STATUSES: Opt[] = [
  { value: "REPORTED", label: "Reported", color: "#64748b" },
  { value: "INVESTIGATING", label: "Investigating", color: "#f59e0b" },
  { value: "SCHEDULED", label: "Scheduled", color: "#6366f1" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#a855f7" },
  { value: "FIXED", label: "Fixed", color: "#22c55e" },
];

export const INCIDENT_CATEGORIES: Opt[] = [
  { value: "INJURY", label: "Injury" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "CUSTOMER_DISPUTE", label: "Customer Dispute" },
  { value: "SECURITY", label: "Security" },
  { value: "EQUIPMENT_FAILURE", label: "Equipment Failure" },
  { value: "OTHER", label: "Other" },
];

export const SHAKE_BAR_CATEGORIES: Opt[] = [
  { value: "PROTEIN", label: "Protein" },
  { value: "PRE_WORKOUT", label: "Pre-Workout" },
  { value: "HYDRATION", label: "Hydration" },
  { value: "ENERGY_DRINKS", label: "Energy Drinks" },
  { value: "SNACKS", label: "Snacks" },
  { value: "OTHER", label: "Other" },
];

export const MARKETING_PLATFORMS: Opt[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "WEBSITE", label: "Website" },
  { value: "EMAIL", label: "Email" },
];

export const MARKETING_CONTENT_STATUSES: Opt[] = [
  { value: "IDEA", label: "Idea", color: "#64748b" },
  { value: "PLANNED", label: "Planned", color: "#6366f1" },
  { value: "FILMED", label: "Filmed", color: "#a855f7" },
  { value: "EDITING", label: "Editing", color: "#d946ef" },
  { value: "APPROVED", label: "Approved", color: "#f59e0b" },
  { value: "SCHEDULED", label: "Scheduled", color: "#38bdf8" },
  { value: "PUBLISHED", label: "Published", color: "#22c55e" },
];

export const CAMPAIGN_TYPES: Opt[] = [
  { value: "MEMBERSHIP_OFFER", label: "Membership Offer" },
  { value: "NEW_EQUIPMENT", label: "New Equipment" },
  { value: "DAY_PASS", label: "Day Pass" },
  { value: "REFERRAL", label: "Referral Campaign" },
  { value: "GYM_EVENT", label: "Gym Event" },
  { value: "OTHER", label: "Other" },
];

export const INTEGRATION_LABELS: Record<string, string> = {
  EMAIL: "Email (admin@musclemassacre.com)",
  ASHBOURNE: "Ashbourne Management",
  WEBSITE: "Website (musclemassacre.com)",
  GOOGLE_CALENDAR: "Google Calendar",
  META: "Meta (Facebook / Instagram)",
};

export function labelFor(list: Opt[], value: string | null | undefined): string {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function colorFor(list: Opt[], value: string | null | undefined, fallback = "#64748b"): string {
  return list.find((i) => i.value === value)?.color ?? fallback;
}
