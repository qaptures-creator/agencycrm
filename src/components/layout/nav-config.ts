import {
  LayoutDashboard,
  KanbanSquare,
  Building2,
  Clapperboard,
  CalendarDays,
  PackageCheck,
  RefreshCcw,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: KanbanSquare },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Projects", href: "/projects", icon: Clapperboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Deliverables", href: "/deliverables", icon: PackageCheck },
  { label: "Retainers", href: "/retainers", icon: RefreshCcw },
  { label: "Finance", href: "/finance", icon: Wallet },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
