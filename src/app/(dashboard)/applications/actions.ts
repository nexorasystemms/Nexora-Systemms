"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/current-staff";
import { canIntake } from "@/lib/roles";

const newApplicationSchema = z.object({
  applicant_id: z.string().uuid(),
  amount_requested: z.coerce.number().positive().max(100000),
  term_months: z.coerce.number().int().min(1).max(60),
  product_type: z.enum(["once_off", "instalment"]),
  next_pay_date: z.string().optional(),
  purpose_category: z.string().optional(),
  purpose_text: z.string().optional(),
  referral_source: z.string().optional(),
  has_prior_credit: z.enum(["no", "had", "have"]).optional(),
});

export type NewApplicationState = { status: "idle" | "error"; message?: string };

// FR-APP-03/04/05: create an Application against an existing Applicant. R-15/FR-APP-04's
// duplicate-live-application block is surfaced here as a warning requiring an explicit
// override reason (recorded to application_overrides) rather than a silent hard stop, since
// only a compliance-role user may grant that override.
export async function createApplication(
  _prev: NewApplicationState,
  formData: FormData,
): Promise<NewApplicationState> {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) {
    return { status: "error", message: "You do not have permission to create applications." };
  }

  const parsed = newApplicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: liveApplications } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", data.applicant_id)
    .not("status", "in", "(settled,declined,withdrawn,handed_over)");

  const overrideReason = formData.get("duplicate_override_reason")?.toString();
  if (liveApplications && liveApplications.length > 0 && !overrideReason) {
    return {
      status: "error",
      message: "This applicant already has a live application (rule R-15). A compliance/admin user must supply an override reason to proceed.",
    };
  }

  const { data: referenceNumber } = await supabase.rpc("next_reference_number", {
    p_tenant_id: staff.tenant_id,
    p_seq_type: "application",
    p_prefix: "APP-",
  });

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      tenant_id: staff.tenant_id,
      applicant_id: data.applicant_id,
      reference_number: referenceNumber ?? `APP-${Date.now()}`,
      amount_requested: data.amount_requested,
      term_months: data.term_months,
      product_type: data.product_type,
      next_pay_date: data.next_pay_date || null,
      purpose_category: data.purpose_category || null,
      purpose_text: data.purpose_text || null,
      referral_source: data.referral_source || null,
      has_prior_credit: data.has_prior_credit || null,
      status: "draft",
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !application) {
    return { status: "error", message: error?.message ?? "Could not create application." };
  }

  if (liveApplications && liveApplications.length > 0 && overrideReason) {
    if (staff.role !== "admin" && staff.role !== "super_admin") {
      return { status: "error", message: "Only a compliance/admin user may override the duplicate-application block." };
    }
    await supabase.from("application_overrides").insert({
      tenant_id: staff.tenant_id,
      application_id: application.id,
      override_type: "duplicate_application",
      reason_code: "R-15-OVERRIDE",
      notes: overrideReason,
      overridden_by: staff.id,
    });
  }

  redirect(`/applications/${application.id}`);
}
