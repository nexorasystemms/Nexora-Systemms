"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBorrower } from "@/lib/current-borrower";

export type ActionState = { status: "idle" | "error" | "success"; message?: string };

// ---------------------------------------------------------------------------
// Registration — collects the same applicant profile staff capture at intake
// (FR-APP-01/02), plus login credentials, in one step. A borrower's own signed-in
// session is the anchor everything else in the portal hangs off, via applicants.auth_user_id
// (see 0009_portal_applicant_accounts.sql).
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2).max(120),
  sex: z.enum(["M", "F"]).optional(),
  id_type: z.enum(["personal_id", "passport"]),
  id_number: z.string().min(4),
  document_number: z.string().optional(),
  mobile: z.string().min(7),
  residential_address: z.string().min(3),
  marital_status: z.enum(["single", "married_in_cop", "married_out_of_cop"]),
  dependants_count: z.coerce.number().int().min(0).max(20),
  next_of_kin_name: z.string().min(2),
  next_of_kin_mobile: z.string().min(7),
});

export async function registerBorrower(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });
  if (signUpError || !signUpData.user) {
    return { status: "error", message: signUpError?.message ?? "Could not create your account." };
  }
  const userId = signUpData.user.id;

  const { data: tenantId, error: tenantError } = await supabase.rpc("portal_default_tenant_id");
  if (tenantError || !tenantId) {
    return { status: "error", message: "No active lender is configured for online applications yet. Please contact TMU CashLoan CC." };
  }

  const { data: hash, error: hashError } = await supabase.rpc("hash_secure_value", { p_plaintext: data.id_number });
  if (hashError || !hash) {
    return { status: "error", message: hashError?.message ?? "Could not process ID number." };
  }

  // Cross-tenant/identity check that RLS deliberately can't do for a signed-in borrower (their
  // own applicants row doesn't exist yet, and they must never be able to browse anyone else's) —
  // the one legitimate use of the service-role client here (see src/lib/supabase/admin.ts).
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("applicants")
    .select("id, auth_user_id")
    .eq("tenant_id", tenantId)
    .eq("id_number_hash", hash)
    .maybeSingle();

  if (existing?.auth_user_id && existing.auth_user_id !== userId) {
    return {
      status: "error",
      message: "An account already exists for this ID number. Please sign in, or contact TMU CashLoan CC if you can't access it.",
    };
  }

  if (existing && !existing.auth_user_id) {
    // A staff-entered walk-in profile with this ID already exists — claim it rather than
    // creating a duplicate applicant, matching the same-identity-once principle intake uses.
    const { error: linkError } = await admin.from("applicants").update({ auth_user_id: userId }).eq("id", existing.id);
    if (linkError) {
      return { status: "error", message: linkError.message };
    }
    redirect("/portal");
  }

  const { data: idToken, error: tokenError } = await supabase.rpc("tokenize_secure_value", {
    p_tenant_id: tenantId,
    p_field_type: "id_number",
    p_plaintext: data.id_number,
  });
  if (tokenError || !idToken) {
    return { status: "error", message: tokenError?.message ?? "Could not secure ID number." };
  }

  let documentToken: string | null = null;
  if (data.document_number) {
    const { data: docToken, error: docTokenError } = await supabase.rpc("tokenize_secure_value", {
      p_tenant_id: tenantId,
      p_field_type: "passport_number",
      p_plaintext: data.document_number,
    });
    if (docTokenError) return { status: "error", message: docTokenError.message };
    documentToken = docToken;
  }

  const { error: insertError } = await supabase.from("applicants").insert({
    tenant_id: tenantId,
    auth_user_id: userId,
    full_name: data.full_name,
    sex: data.sex ?? null,
    id_type: data.id_type,
    id_number_token: idToken,
    id_number_hash: hash,
    document_number_token: documentToken,
    mobile: data.mobile,
    email: data.email,
    residential_address: data.residential_address,
    marital_status: data.marital_status,
    dependants_count: data.dependants_count,
    next_of_kin_name: data.next_of_kin_name,
    next_of_kin_mobile: data.next_of_kin_mobile,
  });
  if (insertError) {
    return { status: "error", message: insertError.message };
  }

  redirect("/portal");
}

// ---------------------------------------------------------------------------
// Application wizard — a borrower may only touch their own applicant_id/application_id,
// enforced by the portal RLS policies, not by role checks like the staff actions use.
// ---------------------------------------------------------------------------

const startApplicationSchema = z.object({
  amount_requested: z.coerce.number().positive().max(100000),
  term_months: z.coerce.number().int().min(1).max(60),
  product_type: z.enum(["once_off", "instalment"]),
  next_pay_date: z.string().optional(),
  purpose_category: z.string().optional(),
  purpose_text: z.string().optional(),
});

export type StartApplicationResult =
  | { status: "error"; message: string }
  | { status: "success"; applicationId: string };

export async function startBorrowerApplication(formData: FormData): Promise<StartApplicationResult> {
  const applicant = await requireBorrower();

  const parsed = startApplicationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: liveApplications } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", applicant.id)
    .not("status", "in", "(settled,declined,withdrawn,handed_over)");

  if (liveApplications && liveApplications.length > 0) {
    return { status: "error", message: "You already have an application in progress — see your dashboard for its status." };
  }

  const { data: referenceNumber } = await supabase.rpc("next_reference_number", {
    p_tenant_id: applicant.tenant_id,
    p_seq_type: "application",
    p_prefix: "APP-",
  });

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      tenant_id: applicant.tenant_id,
      applicant_id: applicant.id,
      reference_number: referenceNumber ?? `APP-${Date.now()}`,
      amount_requested: data.amount_requested,
      term_months: data.term_months,
      product_type: data.product_type,
      next_pay_date: data.next_pay_date || null,
      purpose_category: data.purpose_category || null,
      purpose_text: data.purpose_text || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !application) {
    return { status: "error", message: error?.message ?? "Could not start your application." };
  }

  return { status: "success", applicationId: application.id };
}

const employmentSchema = z.object({
  employer_name: z.string().min(1),
  occupation: z.string().optional(),
  monthly_net_salary: z.coerce.number().positive(),
  employment_start_date: z.string().optional(),
});

export async function saveBorrowerEmployment(applicationId: string, formData: FormData): Promise<ActionState> {
  const applicant = await requireBorrower();

  const parsed = employmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const employmentPayload = {
    tenant_id: applicant.tenant_id,
    application_id: applicationId,
    employer_name: data.employer_name,
    occupation: data.occupation || null,
    monthly_net_salary: data.monthly_net_salary,
    employment_start_date: data.employment_start_date || null,
  };
  const { data: existingEmployment } = await supabase
    .from("employment")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();
  const { error: employmentError } = existingEmployment
    ? await supabase.from("employment").update(employmentPayload).eq("id", existingEmployment.id)
    : await supabase.from("employment").insert(employmentPayload);
  if (employmentError) return { status: "error", message: employmentError.message };

  // Seed the declared basic-income line so the staff engine's A-E-S computation has a starting
  // figure the moment the application reaches assessment — staff can still add/adjust lines.
  // Expenditure lines aren't captured from borrowers in this pass; staff fill those in at review.
  const { error: incomeError } = await supabase.from("income_expenditure").upsert(
    {
      tenant_id: applicant.tenant_id,
      application_id: applicationId,
      line_code: "INC_BASIC",
      amount: data.monthly_net_salary,
      source: "declared",
    },
    { onConflict: "application_id,line_code" },
  );
  if (incomeError) return { status: "error", message: incomeError.message };

  revalidatePath("/portal/apply");
  return { status: "success" };
}

export async function uploadBorrowerDocument(applicationId: string, formData: FormData): Promise<ActionState> {
  const applicant = await requireBorrower();
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  const docType = String(formData.get("doc_type") ?? "");
  if (!file || !docType) return { status: "error", message: "A file and document type are required" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${applicant.tenant_id}/application/${applicationId}/${docType}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return { status: "error", message: uploadError.message };

  const { error } = await supabase.from("documents").insert({
    tenant_id: applicant.tenant_id,
    entity_type: "application",
    entity_id: applicationId,
    doc_type: docType,
    file_path: path,
    sha256_hash: hash,
    uploaded_by: null,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/portal/apply");
  return { status: "success" };
}

const CONSENT_TYPES = [
  "credit_assessment",
  "bureau_enquiry_and_submission",
  "debt_collection_disclosure",
  "cession_disclosure",
] as const; // marketing is optional and handled separately — FR-CONSENT-01 unbundling

export async function submitBorrowerApplication(applicationId: string, formData: FormData): Promise<ActionState> {
  const applicant = await requireBorrower();
  const supabase = await createClient();

  for (const consentType of CONSENT_TYPES) {
    if (formData.get(`consent_${consentType}`) !== "on") {
      return { status: "error", message: "All required consents must be accepted before you can submit." };
    }
  }

  const consentRows = [
    ...CONSENT_TYPES.map((consent_type) => ({ consent_type, granted: true })),
    { consent_type: "marketing" as const, granted: formData.get("consent_marketing") === "on" },
  ].map((c) => ({
    tenant_id: applicant.tenant_id,
    applicant_id: applicant.id,
    application_id: applicationId,
    consent_type: c.consent_type,
    granted: c.granted,
    channel: "portal",
    granted_at: c.granted ? new Date().toISOString() : null,
  }));

  const { error: consentError } = await supabase.from("consents").insert(consentRows);
  if (consentError) return { status: "error", message: consentError.message };

  const { error: statusError } = await supabase
    .from("applications")
    .update({ status: "submitted" })
    .eq("id", applicationId)
    .eq("status", "draft");
  if (statusError) return { status: "error", message: statusError.message };

  revalidatePath("/portal");
  return { status: "success" };
}
