"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/current-staff";

export async function addPolicyParam(formData: FormData) {
  const staff = await requireRole(["admin", "super_admin"]);
  if (!staff.tenant_id) throw new Error("Super admin must act within a tenant context (Section 4.6 requires an active template gate too).");
  const supabase = await createClient();

  const paramKey = String(formData.get("param_key") ?? "");
  const rawValue = String(formData.get("param_value") ?? "");
  const numericValue = Number(rawValue);
  const value = Number.isFinite(numericValue) && rawValue.trim() !== "" ? numericValue : rawValue;

  const { error } = await supabase.from("policy_params").insert({
    tenant_id: staff.tenant_id,
    param_key: paramKey,
    param_value: value,
    effective_from: String(formData.get("effective_from") ?? new Date().toISOString().slice(0, 10)),
    note: String(formData.get("note") ?? "") || null,
    created_by: staff.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/policy-params");
}

export async function activateTemplate(templateId: string) {
  const staff = await requireRole(["admin", "super_admin"]);
  if (!staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const { data: template } = await supabase.from("agreement_templates").select("attorney_reviewed").eq("id", templateId).single();
  if (!template?.attorney_reviewed) {
    throw new Error("Cannot activate: attorney review has not been recorded for this template (FR-AGR-08).");
  }

  await supabase.from("agreement_templates").update({ status: "retired" }).eq("tenant_id", staff.tenant_id).eq("status", "active");
  const { error } = await supabase.from("agreement_templates").update({ status: "active" }).eq("id", templateId);
  if (error) throw new Error(error.message);
  revalidatePath("/policy-params");
}

export async function recordAttorneyReview(templateId: string) {
  const staff = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("agreement_templates").update({
    attorney_reviewed: true,
    attorney_reviewed_by: staff.id,
    attorney_reviewed_at: new Date().toISOString(),
  }).eq("id", templateId);
  if (error) throw new Error(error.message);
  revalidatePath("/policy-params");
}

export async function createTemplate(formData: FormData) {
  const staff = await requireRole(["admin", "super_admin"]);
  if (!staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const { error } = await supabase.from("agreement_templates").insert({
    tenant_id: staff.tenant_id,
    name: String(formData.get("name") ?? ""),
    version: String(formData.get("version") ?? "1.0"),
    content: String(formData.get("content") ?? ""),
    includes_notary_clause: formData.get("includes_notary_clause") === "on",
    includes_cession_clause: formData.get("includes_cession_clause") === "on",
    created_by: staff.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/policy-params");
}
