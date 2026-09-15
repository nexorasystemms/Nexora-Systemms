"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/current-staff";

export async function createTenant(formData: FormData) {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const namfisaReg = String(formData.get("namfisa_reg_number") ?? "");

  const { error } = await supabase.from("tenants").insert({ name, slug, namfisa_reg_number: namfisaReg || null });
  if (error) throw new Error(error.message);
  revalidatePath("/tenants");
}
