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
  { label: "Live Entry", href: "/gym/live-entry", icon: DoorOpen },
  { label: "Memberships", href: "/gym/memberships", icon: IdCard, roles: ["OWNER", "MANAGER"] },
  { label: "Finances", href: "/gym/finances", icon: LineChart, roles: ["OWNER", "MANAGER"] },
  { label: "Payments", href: "/gym/payments", icon: CreditCard, roles: ["OWNER", "MANAGER"] },
  { label: "Reports", href: "/gym/reports", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { label: "Enquiries", href: "/gym/enquiries", icon: Inbox },
  { label: "Leads", href: "/gym/leads", icon: Target, roles: ["OWNER", "MANAGER", "MARKETING", "STAFF"] },
  { label: "Shake Bar", href: "/gym/shake-bar", icon: CupSoda },
  { label: "Email", href: "/gym/email", icon: Mail, roles: ["OWNER", "MANAGER", "STAFF"] },
  { label: "Communications", href: "/gym/communications", icon: MessagesSquare },
  { label: "Staff", href: "/gym/staff", icon: UserCog, roles: ["OWNER", "MANAGER"] },
  { label: "Rota", href: "/gym/rota", icon: CalendarClock },
  { label: "Tasks", href: "/gym/tasks", icon: ListChecks },
  { label: "Equipment", href: "/gym/equipment", icon: Dumbbell },
  { label: "Maintenance", href: "/gym/maintenance", icon: Wrench },
  { label: "Cleaning", href: "/gym/cleaning", icon: SprayCan },
  { label: "Incidents", href: "/gym/incidents", icon: ShieldAlert },
  { label: "Marketing", href: "/gym/marketing", icon: Megaphone, roles: ["OWNER", "MANAGER", "MARKETING"] },
  { label: "Integrations", href: "/gym/integrations", icon: Plug, roles: ["OWNER"] },
  { label: "Settings", href: "/gym/settings", icon: Settings, roles: ["OWNER", "MANAGER"] },
];

export function navItemsForRole(role: GymAccessRole): GymNavItem[] {
  return GYM_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
