export type GymAccessRole = "OWNER" | "MANAGER" | "STAFF" | "MARKETING";

export const ACCESS_ROLES: { value: GymAccessRole; label: string }[] = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "STAFF", label: "Staff" },
  { value: "MARKETING", label: "Marketing" },
];

type PermissionKey =
  | "viewFinance"
  | "viewPayroll"
  | "manageStaff"
  | "manageRota"
  | "manageIntegrations"
  | "manageSettings"
  | "viewAllIncidents"
  | "manageAuditLog"
  | "manageMemberships"
  | "manageTasks"
  | "viewMarketing"
  | "manageMarketing";

const MATRIX: Record<GymAccessRole, Record<PermissionKey, boolean>> = {
  OWNER: {
    viewFinance: true,
    viewPayroll: true,
    manageStaff: true,
    manageRota: true,
    manageIntegrations: true,
    manageSettings: true,
    viewAllIncidents: true,
    manageAuditLog: true,
    manageMemberships: true,
    manageTasks: true,
    viewMarketing: true,
    manageMarketing: true,
  },
  MANAGER: {
    viewFinance: true,
    viewPayroll: false,
    manageStaff: true,
    manageRota: true,
    manageIntegrations: false,
    manageSettings: false,
    viewAllIncidents: true,
    manageAuditLog: false,
    manageMemberships: true,
    manageTasks: true,
    viewMarketing: true,
    manageMarketing: true,
  },
  STAFF: {
    viewFinance: false,
    viewPayroll: false,
    manageStaff: false,
    manageRota: false,
    manageIntegrations: false,
    manageSettings: false,
    viewAllIncidents: false,
    manageAuditLog: false,
    manageMemberships: false,
    manageTasks: false,
    viewMarketing: false,
    manageMarketing: false,
  },
  MARKETING: {
    viewFinance: false,
    viewPayroll: false,
    manageStaff: false,
    manageRota: false,
    manageIntegrations: false,
    manageSettings: false,
    viewAllIncidents: false,
    manageAuditLog: false,
    manageMemberships: false,
    manageTasks: false,
    viewMarketing: true,
    manageMarketing: true,
  },
};

export function can(role: GymAccessRole | null | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  return MATRIX[role]?.[permission] ?? false;
}

export function roleLabel(role: string | null | undefined): string {
  return ACCESS_ROLES.find((r) => r.value === role)?.label ?? role ?? "Staff";
}
