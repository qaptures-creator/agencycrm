import {
  LayoutDashboard,
  Users,
  Inbox,
  Mail,
  UserCog,
  CalendarClock,
  ListChecks,
  IdCard,
  LineChart,
  CreditCard,
  Target,
  MessagesSquare,
  Dumbbell,
  Wrench,
  SprayCan,
  ShieldAlert,
  CupSoda,
  Megaphone,
  BarChart3,
  Plug,
  Settings,
  DoorOpen,
  type LucideIcon,
} from "lucide-react";
export type GymNavGroupKey = "members" | "money" | "growth" | "comms" | "team" | "facilities" | "admin";

// A small colour dot next to each sidebar item signals which of these
// conceptual groups it belongs to — purely visual grouping, doesn't affect
// navigation or permissions. Colours are picked to stay clear of the
// success/warning/destructive greens-ambers-reds already used for status
// elsewhere in the UI. Dashboard has no group — it's the one shared
// entry point, not part of a cluster.
export const NAV_GROUPS: Record<GymNavGroupKey, { label: string; color: string }> = {
  members: { label: "Members & Access", color: "#60a5fa" }, // blue
  money: { label: "Money", color: "#2dd4bf" }, // teal
  growth: { label: "Growth", color: "#fb923c" }, // orange
  comms: { label: "Comms", color: "#f472b6" }, // pink
  team: { label: "Team & Ops", color: "#818cf8" }, // indigo
  facilities: { label: "Facilities", color: "#22d3ee" }, // cyan
  admin: { label: "Admin", color: "#94a3b8" }, // slate
};

export type GymNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: GymNavGroupKey;
};

// Which roles can see each of these is no longer decided here — it's the
// DB-backed Staff Roles matrix (Settings → Staff Roles, see
// src/lib/gym/role-permissions.ts). This array is now purely label/href/
// icon/group: the full tab catalog, in sidebar order.
export const GYM_NAV_ITEMS: GymNavItem[] = [
  { label: "Dashboard", href: "/gym", icon: LayoutDashboard },
  { label: "Members", href: "/gym/members", icon: Users, group: "members" },
  { label: "Entry", href: "/gym/live-entry", icon: DoorOpen, group: "members" },
  { label: "Memberships", href: "/gym/memberships", icon: IdCard, group: "members" },
  { label: "Finances", href: "/gym/finances", icon: LineChart, group: "money" },
  { label: "Payments", href: "/gym/payments", icon: CreditCard, group: "money" },
  { label: "Reports", href: "/gym/reports", icon: BarChart3, group: "money" },
  { label: "Enquiries", href: "/gym/enquiries", icon: Inbox, group: "growth" },
  { label: "Leads", href: "/gym/leads", icon: Target, group: "growth" },
  { label: "Shake Bar", href: "/gym/shake-bar", icon: CupSoda, group: "money" },
  { label: "Email", href: "/gym/email", icon: Mail, group: "comms" },
  { label: "Communications", href: "/gym/communications", icon: MessagesSquare, group: "comms" },
  { label: "Staff", href: "/gym/staff", icon: UserCog, group: "team" },
  { label: "Rota", href: "/gym/rota", icon: CalendarClock, group: "team" },
  { label: "Tasks", href: "/gym/tasks", icon: ListChecks, group: "team" },
  { label: "Equipment", href: "/gym/equipment", icon: Dumbbell, group: "facilities" },
  { label: "Maintenance", href: "/gym/maintenance", icon: Wrench, group: "facilities" },
  { label: "Cleaning", href: "/gym/cleaning", icon: SprayCan, group: "facilities" },
  { label: "Incidents", href: "/gym/incidents", icon: ShieldAlert, group: "facilities" },
  { label: "Marketing", href: "/gym/marketing", icon: Megaphone, group: "growth" },
  { label: "Integrations", href: "/gym/integrations", icon: Plug, group: "admin" },
  { label: "Settings", href: "/gym/settings", icon: Settings, group: "admin" },
];

/** Filters the tab catalog down to what a specific request's caller may
 * see, given the allowedHrefs already resolved server-side (OWNER gets
 * every href; other roles get whatever Settings → Staff Roles saved). */
export function navItemsForAllowedHrefs(allowedHrefs: string[]): GymNavItem[] {
  return GYM_NAV_ITEMS.filter((item) => allowedHrefs.includes(item.href));
}
