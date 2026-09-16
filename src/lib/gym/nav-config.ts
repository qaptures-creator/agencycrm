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
export type GymNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Which roles can see each of these is no longer decided here — it's the
// DB-backed Staff Roles matrix (Settings → Staff Roles, see
// src/lib/gym/role-permissions.ts). This array is now purely label/href/
// icon: the full tab catalog, in sidebar order.
export const GYM_NAV_ITEMS: GymNavItem[] = [
  { label: "Dashboard", href: "/gym", icon: LayoutDashboard },
  { label: "Members", href: "/gym/members", icon: Users },
  { label: "Live Entry", href: "/gym/live-entry", icon: DoorOpen },
  { label: "Memberships", href: "/gym/memberships", icon: IdCard },
  { label: "Finances", href: "/gym/finances", icon: LineChart },
  { label: "Payments", href: "/gym/payments", icon: CreditCard },
  { label: "Reports", href: "/gym/reports", icon: BarChart3 },
  { label: "Enquiries", href: "/gym/enquiries", icon: Inbox },
  { label: "Leads", href: "/gym/leads", icon: Target },
  { label: "Shake Bar", href: "/gym/shake-bar", icon: CupSoda },
  { label: "Email", href: "/gym/email", icon: Mail },
  { label: "Communications", href: "/gym/communications", icon: MessagesSquare },
  { label: "Staff", href: "/gym/staff", icon: UserCog },
  { label: "Rota", href: "/gym/rota", icon: CalendarClock },
  { label: "Tasks", href: "/gym/tasks", icon: ListChecks },
  { label: "Equipment", href: "/gym/equipment", icon: Dumbbell },
  { label: "Maintenance", href: "/gym/maintenance", icon: Wrench },
  { label: "Cleaning", href: "/gym/cleaning", icon: SprayCan },
  { label: "Incidents", href: "/gym/incidents", icon: ShieldAlert },
  { label: "Marketing", href: "/gym/marketing", icon: Megaphone },
  { label: "Integrations", href: "/gym/integrations", icon: Plug },
  { label: "Settings", href: "/gym/settings", icon: Settings },
];

/** Filters the tab catalog down to what a specific request's caller may
 * see, given the allowedHrefs already resolved server-side (OWNER gets
 * every href; other roles get whatever Settings → Staff Roles saved). */
export function navItemsForAllowedHrefs(allowedHrefs: string[]): GymNavItem[] {
  return GYM_NAV_ITEMS.filter((item) => allowedHrefs.includes(item.href));
}
