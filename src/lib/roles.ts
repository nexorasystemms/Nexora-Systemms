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

export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  visible: (role: StaffRole) => boolean;
}> = [
  { href: "/", label: "Pipeline", visible: () => true },
  { href: "/applicants", label: "Applicants", visible: canIntake },
  { href: "/applications/new", label: "New Application", visible: canIntake },
  { href: "/arrears", label: "Arrears", visible: () => true },
  { href: "/reports", label: "Reports", visible: () => true },
  { href: "/audit-log", label: "Audit Log", visible: canViewAuditLog },
  { href: "/policy-params", label: "Policy Parameters", visible: canManagePolicyParams },
  { href: "/users", label: "Staff & Roles", visible: canManageUsers },
  { href: "/tenants", label: "Tenants", visible: (role) => role === "super_admin" },
];
