import {
  LayoutDashboard,
  Users,
  Inbox,
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
  ShieldAlert,
  CupSoda,
  Megaphone,
  BarChart3,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { GymAccessRole } from "@/lib/gym/permissions";

export type GymNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: GymAccessRole[];
};

export const GYM_NAV_ITEMS: GymNavItem[] = [
  { label: "Dashboard", href: "/gym", icon: LayoutDashboard },
  { label: "Members", href: "/gym/members", icon: Users, roles: ["OWNER", "MANAGER", "STAFF"] },
  { label: "Enquiries", href: "/gym/enquiries", icon: Inbox },
  { label: "Staff", href: "/gym/staff", icon: UserCog, roles: ["OWNER", "MANAGER"] },
  { label: "Rota", href: "/gym/rota", icon: CalendarClock },
  { label: "Tasks", href: "/gym/tasks", icon: ListChecks },
  { label: "Memberships", href: "/gym/memberships", icon: IdCard, roles: ["OWNER", "MANAGER"] },
  { label: "Finances", href: "/gym/finances", icon: LineChart, roles: ["OWNER", "MANAGER"] },
  { label: "Payments", href: "/gym/payments", icon: CreditCard, roles: ["OWNER", "MANAGER"] },
  { label: "Leads", href: "/gym/leads", icon: Target, roles: ["OWNER", "MANAGER", "MARKETING", "STAFF"] },
  { label: "Communications", href: "/gym/communications", icon: MessagesSquare },
  { label: "Equipment", href: "/gym/equipment", icon: Dumbbell },
  { label: "Maintenance", href: "/gym/maintenance", icon: Wrench },
  { label: "Incidents", href: "/gym/incidents", icon: ShieldAlert },
  { label: "Shake Bar", href: "/gym/shake-bar", icon: CupSoda },
  { label: "Marketing", href: "/gym/marketing", icon: Megaphone, roles: ["OWNER", "MANAGER", "MARKETING"] },
  { label: "Reports", href: "/gym/reports", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { label: "Integrations", href: "/gym/integrations", icon: Plug, roles: ["OWNER"] },
  { label: "Settings", href: "/gym/settings", icon: Settings, roles: ["OWNER", "MANAGER"] },
];

export function navItemsForRole(role: GymAccessRole): GymNavItem[] {
  return GYM_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
