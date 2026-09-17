import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/types/database";

/** Loads the signed-in staff record (public.users), or redirects to /login. Every dashboard
 *  page should call this first — it is the single source of truth for role-gating a screen. */
export async function requireStaff(): Promise<UserRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staff, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !staff) redirect("/login?error=no_staff_record");
  if (staff.status !== "active") redirect("/login?error=inactive_account");
  if (staff.role === "borrower") redirect("/portal");

  return staff;
}

export async function requireRole(allowed: UserRow["role"][]): Promise<UserRow> {
  const staff = await requireStaff();
  if (!allowed.includes(staff.role)) redirect("/?error=forbidden");
  return staff;
}
