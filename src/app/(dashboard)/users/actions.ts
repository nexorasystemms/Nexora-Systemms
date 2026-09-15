"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/current-staff";
import type { StaffRole } from "@/types/database";

// FR-CORE-02: staff accounts are tenant-scoped, individually attributable, one role each.
// Creates the Supabase Auth user (service-role admin API) and the matching public.users row
// in one step, so an invited staff member can sign in and immediately hit the MFA-enrolment
// gate (FR-CORE-03) on first login.
export async function inviteStaff(formData: FormData) {
  const staff = await requireRole(["admin", "super_admin"]);

  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const role = String(formData.get("role") ?? "") as StaffRole;
  const isSuperAdminInvite = role === "super_admin";

  if (isSuperAdminInvite && staff.role !== "super_admin") {
    throw new Error("Only a super admin may invite another super admin.");
  }
  if (!isSuperAdminInvite && !staff.tenant_id) {
    throw new Error("A tenant admin cannot invite a tenant-scoped user without a tenant context.");
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email);
  if (createError || !created?.user) {
    throw new Error(createError?.message ?? "Could not create the auth user.");
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("users").insert({
    id: created.user.id,
    tenant_id: isSuperAdminInvite ? null : staff.tenant_id,
    email,
    full_name: fullName,
    role,
    platform_role: isSuperAdminInvite ? "super_admin" : "tenant_user",
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(insertError.message);
  }

  revalidatePath("/users");
}

// FR-CORE-05: deactivate a staff account immediately. RLS's current_tenant_id/current_staff_role
// helpers filter on status = 'active', so this alone revokes all data access regardless of
// whether the JWT itself is still technically valid.
export async function setStaffStatus(userId: string, status: "active" | "inactive") {
  await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ status }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/users");
}
