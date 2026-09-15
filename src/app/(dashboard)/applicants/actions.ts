"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/current-staff";
import { canIntake } from "@/lib/roles";

const applicantSchema = z.object({
  full_name: z.string().min(2).max(120),
  sex: z.enum(["M", "F"]).optional(),
  id_type: z.enum(["personal_id", "passport"]),
  id_number: z.string().min(4),
  document_number: z.string().optional(),
  mobile: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  residential_address: z.string().min(3),
  marital_status: z.enum(["single", "married_in_cop", "married_out_of_cop"]),
  dependants_count: z.coerce.number().int().min(0).max(20),
  next_of_kin_name: z.string().min(2),
  next_of_kin_mobile: z.string().min(7),
});

export type ApplicantFormState = {
  status: "idle" | "duplicate" | "error" | "success";
  message?: string;
  duplicateApplicantId?: string;
  applicantId?: string;
};

// FR-APP-01/02: create an Applicant, checking for an existing one by ID-number first so we
// never silently duplicate a person. ID number is tokenised (NFR-SEC-01) via a HMAC blind
// index (id_number_hash) for the dedupe check — see 0005_functions_triggers.sql.
export async function createApplicant(
  _prev: ApplicantFormState,
  formData: FormData,
): Promise<ApplicantFormState> {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) {
    return { status: "error", message: "You do not have permission to create applicants." };
  }

  const parsed = applicantSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const { data: hash, error: hashError } = await supabase.rpc("hash_secure_value", { p_plaintext: data.id_number });
  if (hashError || !hash) {
    return { status: "error", message: hashError?.message ?? "Could not process ID number." };
  }

  const { data: existing } = await supabase
    .from("applicants")
    .select("id, full_name")
    .eq("tenant_id", staff.tenant_id)
    .eq("id_number_hash", hash)
    .maybeSingle();

  if (existing) {
    return {
      status: "duplicate",
      message: `An applicant with this ID number already exists: ${existing.full_name}.`,
      duplicateApplicantId: existing.id,
    };
  }

  const { data: idToken, error: tokenError } = await supabase.rpc("tokenize_secure_value", {
    p_tenant_id: staff.tenant_id,
    p_field_type: "id_number",
    p_plaintext: data.id_number,
  });
  if (tokenError || !idToken) {
    return { status: "error", message: tokenError?.message ?? "Could not secure ID number." };
  }

  let documentToken: string | null = null;
  if (data.document_number) {
    const { data: docToken, error: docTokenError } = await supabase.rpc("tokenize_secure_value", {
      p_tenant_id: staff.tenant_id,
      p_field_type: "passport_number",
      p_plaintext: data.document_number,
    });
    if (docTokenError) {
      return { status: "error", message: docTokenError.message };
    }
    documentToken = docToken;
  }

  const { data: applicant, error: insertError } = await supabase
    .from("applicants")
    .insert({
      tenant_id: staff.tenant_id,
      full_name: data.full_name,
      sex: data.sex ?? null,
      id_type: data.id_type,
      id_number_token: idToken,
      id_number_hash: hash,
      document_number_token: documentToken,
      mobile: data.mobile,
      email: data.email || null,
      residential_address: data.residential_address,
      marital_status: data.marital_status,
      dependants_count: data.dependants_count,
      next_of_kin_name: data.next_of_kin_name,
      next_of_kin_mobile: data.next_of_kin_mobile,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (insertError || !applicant) {
    return { status: "error", message: insertError?.message ?? "Could not create applicant." };
  }

  return { status: "success", applicantId: applicant.id };
}
