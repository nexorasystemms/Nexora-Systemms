import type { StaffRole } from "@/types/database";

// The SRS's six-role catalogue (Table 1 / NFR-SEC-10) mapped onto the three-tier model the
// product is described in: super admin (Nexora, cross-tenant) / admin (tenant compliance,
// principal officer, owner) / user (the functional staff roles that actually run the desk).
export const ROLE_TIER: Record<StaffRole, "super_admin" | "admin" | "user"> = {
  super_admin: "super_admin",
  admin: "admin",
  intake: "user",
  officer: "user",
  approver: "user",
  finance: "user",
  borrower: "user",
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin (Nexora)",
  admin: "Admin (Compliance / Principal Officer)",
  intake: "Intake Clerk",
  officer: "Loan Officer",
  approver: "Approver / Branch Manager",
  finance: "Finance / Disburser",
  borrower: "Borrower / Applicant",
};

export function isBorrower(role: StaffRole): boolean {
  return role === "borrower";
}

export function roleLabel(role: StaffRole): string {
  return ROLE_LABELS[role];
}

export function isAdminTier(role: StaffRole): boolean {
  return role === "admin" || role === "super_admin";
}

export function canManagePolicyParams(role: StaffRole): boolean {
  return isAdminTier(role);
}

export function canManageUsers(role: StaffRole): boolean {
  return isAdminTier(role);
}

export function canIntake(role: StaffRole): boolean {
  return role === "intake" || role === "officer" || isAdminTier(role);
}

export function canReviewDocuments(role: StaffRole): boolean {
  return role === "officer" || role === "approver" || isAdminTier(role);
}

export function canDecide(role: StaffRole): boolean {
  return role === "approver" || isAdminTier(role);
}

export function canDisburse(role: StaffRole): boolean {
  return role === "finance" || isAdminTier(role);
}

export function canViewAuditLog(role: StaffRole): boolean {
  return role === "approver" || isAdminTier(role);
}

export function canUnmaskT3(role: StaffRole): boolean {
  return role === "approver" || role === "finance" || isAdminTier(role);
}

export type NavBadge = "applications" | "pilotStatus" | null;

export const NAV_GROUPS: Array<{
  group: string;
  items: Array<{
    href: string;
    label: string;
    icon: string;
    badge?: NavBadge;
    visible: (role: StaffRole) => boolean;
  }>;
}> = [
  {
    group: "Core Lending Operations",
    items: [
      { href: "/dashboard", label: "Applications", icon: "view_kanban", badge: "applications", visible: () => true },
      { href: "/dashboard/applicants", label: "New Intake", icon: "person_add", visible: canIntake },
      { href: "/dashboard/arrears", label: "Servicing & Arrears", icon: "history_toggle_off", visible: () => true },
      { href: "/dashboard/reports", label: "Reports", icon: "monitoring", visible: () => true },
    ],
  },
  {
    group: "Governance & Audit",
    items: [
      { href: "/dashboard/audit-log", label: "Audit Chaining", icon: "lock_clock", visible: canViewAuditLog },
      { href: "/dashboard/consents", label: "Consents & KYC", icon: "verified_user", visible: canViewAuditLog },
      { href: "/dashboard/policy-params", label: "Policy Parameters", icon: "tune", visible: canManagePolicyParams },
      { href: "/dashboard/pilot-guardrails", label: "Pilot Guardrails", icon: "shield", badge: "pilotStatus", visible: canManagePolicyParams },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/dashboard/users", label: "Staff & Roles", icon: "admin_panel_settings", visible: canManageUsers },
      { href: "/dashboard/tenants", label: "Tenants", icon: "domain", visible: (role) => role === "super_admin" },
    ],
  },
];
