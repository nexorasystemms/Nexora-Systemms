"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBorrower } from "@/lib/current-borrower";

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name is required (at least 2 characters)"),
  id_type: z.enum(["personal_id", "passport"]).default("personal_id"),
  id_number: z.string().min(4, "Valid ID number is required"),
  mobile: z.string().min(7, "Valid mobile number is required"),
  email: z.string().email("Valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function registerBorrower(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const data = parsed.data;
  const admin = createAdminClient();
  const supabase = await createClient();

  // Find default active tenant (e.g. TMU CashLoan CC)
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!tenant) {
    return { status: "error", message: "System configuration error: No active lending tenant." };
  }

  // 1. Hash the ID number using HMAC blind index RPC or SHA-256 fallback
  let idHash: string;
  const { data: rpcHash, error: hashError } = await admin.rpc("hash_secure_value", {
    p_plaintext: data.id_number.trim(),
  });

  if (hashError || !rpcHash) {
    idHash = createHash("sha256").update(data.id_number.trim()).digest("hex");
  } else {
    idHash = rpcHash;
  }

  // 2. Check if an Applicant record already exists with this ID number
  const { data: existingApplicant } = await admin
    .from("applicants")
    .select("id, full_name")
    .eq("tenant_id", tenant.id)
    .eq("id_number_hash", idHash)
    .maybeSingle();

  let applicantId: string;

  if (existingApplicant) {
    applicantId = existingApplicant.id;
  } else {
    // Tokenise and create a new applicant profile
    let idToken = `tok_id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data: rpcToken } = await admin.rpc("tokenize_secure_value", {
      p_tenant_id: tenant.id,
      p_field_type: "id_number",
      p_plaintext: data.id_number.trim(),
    });
    if (rpcToken) idToken = rpcToken;

    const { data: newApplicant, error: createApplicantError } = await admin
      .from("applicants")
      .insert({
        tenant_id: tenant.id,
        full_name: data.full_name.trim(),
        id_type: data.id_type,
        id_number_token: idToken,
        id_number_hash: idHash,
        mobile: data.mobile.trim(),
        email: data.email.trim().toLowerCase(),
        residential_address: "Address on file",
        marital_status: "single",
        dependants_count: 0,
        next_of_kin_name: "Not provided",
        next_of_kin_mobile: "0000000",
      })
      .select("id")
      .single();

    if (createApplicantError || !newApplicant) {
      return {
        status: "error",
        message: createApplicantError?.message ?? "Could not create applicant record.",
      };
    }
    applicantId = newApplicant.id;
  }

  // 3. Create Auth User in Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: {
      role: "borrower",
      full_name: data.full_name.trim(),
    },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes("already been registered")) {
      return { status: "error", message: "An account with this email already exists. Please log in." };
    }
    return { status: "error", message: authError?.message ?? "Could not create user credentials." };
  }

  // 4. Create Public User Profile
  const { error: userInsertError } = await admin.from("users").insert({
    id: authData.user.id,
    tenant_id: tenant.id,
    applicant_id: applicantId,
    email: data.email.trim().toLowerCase(),
    full_name: data.full_name.trim(),
    phone: data.mobile.trim(),
    platform_role: "tenant_user",
    role: "borrower",
    status: "active",
  });

  if (userInsertError) {
    // Clean up auth user on failure
    await admin.auth.admin.deleteUser(authData.user.id);
    return { status: "error", message: userInsertError.message };
  }

  // 5. Sign in the newly created borrower
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email.trim().toLowerCase(),
    password: data.password,
  });

  if (signInError) {
    return { status: "error", message: "Account created successfully, but automatic login failed. Please log in." };
  }

  redirect("/portal");
}

export async function loginBorrower(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", message: "Please enter both email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { status: "error", message: "Invalid email or password." };
  }

  // Verify borrower role in public.users
  const { data: profile } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return { status: "error", message: "Account profile not found. Please contact support." };
  }

  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return { status: "error", message: "Your account is inactive. Please contact TMU CashLoan CC." };
  }

  if (profile.role !== "borrower") {
    await supabase.auth.signOut();
    return { status: "error", message: "Staff accounts must use the staff login at /login." };
  }

  redirect("/portal");
}

export async function borrowerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export async function borrowerUploadDocument(applicationId: string, formData: FormData) {
  const { user, applicant } = await requireBorrower();
  if (!applicant) throw new Error("No applicant record associated with your account.");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Security check: verify application belongs to borrower
  const { data: application } = await admin
    .from("applications")
    .select("id, applicant_id, status")
    .eq("id", applicationId)
    .single();

  if (!application || application.applicant_id !== applicant.id) {
    throw new Error("Unauthorized: Application does not belong to your account.");
  }

  const file = formData.get("file") as File | null;
  const docType = String(formData.get("doc_type") ?? "");

  if (!file || file.size === 0) throw new Error("Please select a file to upload.");
  if (!docType) throw new Error("Document type is required.");

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${applicationId}/${docType}-${Date.now()}.${ext}`;

  // Upload to Supabase storage bucket
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.warn("Storage upload failed, recording file path directly:", uploadError.message);
  }

  // Insert document record
  const { error: insertError } = await admin.from("documents").insert({
    tenant_id: user.tenant_id ?? application.applicant_id,
    entity_type: "application",
    entity_id: applicationId,
    doc_type: docType,
    file_path: path,
    sha256_hash: sha256,
    status: "pending",
    uploaded_by: user.id,
  });

  if (insertError) throw new Error(insertError.message);

  // If application was awaiting documents, transition to under_review
  if (application.status === "awaiting_documents") {
    await admin.from("applications").update({ status: "under_review" }).eq("id", applicationId);
  }

  revalidatePath("/portal");
}

export async function borrowerAcceptAgreement(applicationId: string, agreementId: string) {
  const { applicant } = await requireBorrower();
  if (!applicant) throw new Error("No applicant record found.");

  const admin = createAdminClient();

  const { data: application } = await admin
    .from("applications")
    .select("id, applicant_id, status")
    .eq("id", applicationId)
    .single();

  if (!application || application.applicant_id !== applicant.id) {
    throw new Error("Unauthorized: Application does not belong to your account.");
  }

  const { data: agreement } = await admin
    .from("agreements")
    .select("id, pdf_sha256_hash")
    .eq("id", agreementId)
    .single();

  if (!agreement) throw new Error("Loan agreement not found.");

  // Record digital acceptance per FR-AGR-06
  const { error: updateError } = await admin
    .from("agreements")
    .update({
      acceptance_method: "device_signature",
      acceptance_timestamp: new Date().toISOString(),
      acceptance_document_hash: agreement.pdf_sha256_hash ?? null,
      acceptance_ip: "borrower_portal_web",
    })
    .eq("id", agreementId);

  if (updateError) throw new Error(updateError.message);

  await admin.from("applications").update({ status: "agreement_accepted" }).eq("id", applicationId);

  revalidatePath("/portal");
}

export async function submitBorrowerApplication(formData: FormData) {
  const { user, applicant } = await requireBorrower();
  if (!applicant) throw new Error("Applicant profile not found. Please log in again.");

  const admin = createAdminClient();
  const supabase = await createClient();

  const amountRequested = Number(formData.get("amount_requested") ?? 0);
  const termMonths = Number(formData.get("term_months") ?? 1);
  const productType = (formData.get("product_type") as "once_off" | "instalment") || "once_off";
  const nextPayDate = String(formData.get("next_pay_date") ?? "") || null;
  const purposeCategory = String(formData.get("purpose_category") ?? "general");
  const purposeText = String(formData.get("purpose_text") ?? "");

  if (amountRequested <= 0 || amountRequested > 100000) {
    throw new Error("Loan amount must be between N$100 and N$100,000 (NAMFISA cap).");
  }

  // 1. Generate Application Reference
  const { data: ref } = await admin.rpc("next_reference_number", {
    p_tenant_id: user.tenant_id!,
    p_seq_type: "application",
    p_prefix: "APP-",
  });
  const referenceNumber = ref ?? `APP-${Date.now()}`;

  // 2. Insert Application
  const { data: app, error: appError } = await admin
    .from("applications")
    .insert({
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      reference_number: referenceNumber,
      amount_requested: amountRequested,
      term_months: termMonths,
      product_type: productType,
      next_pay_date: nextPayDate,
      purpose_category: purposeCategory,
      purpose_text: purposeText || null,
      status: "submitted",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (appError || !app) throw new Error(appError?.message ?? "Could not create application.");

  // 3. Snapshot Employment
  const employerName = String(formData.get("employer_name") ?? "");
  const occupation = String(formData.get("occupation") ?? "");
  const monthlyNetSalary = Number(formData.get("monthly_net_salary") ?? 0);
  const employmentStartDate = String(formData.get("employment_start_date") ?? "") || null;

  if (employerName) {
    await admin.from("employment").insert({
      tenant_id: user.tenant_id!,
      application_id: app.id,
      employer_name: employerName,
      occupation: occupation || null,
      monthly_net_salary: monthlyNetSalary || null,
      employment_start_date: employmentStartDate,
    });
  }

  // 4. Initial Income / Expenditure (Declared basic salary)
  if (monthlyNetSalary > 0) {
    await admin.from("income_expenditure").insert([
      {
        tenant_id: user.tenant_id!,
        application_id: app.id,
        line_code: "INC_BASIC",
        amount: monthlyNetSalary,
        source: "declared",
      },
    ]);
  }

  // 5. Handle Document Uploads if provided
  const idDocFile = formData.get("id_document") as File | null;
  const payslipFile = formData.get("payslip_document") as File | null;
  const bankFile = formData.get("bank_document") as File | null;

  const docsToUpload: Array<{ file: File; doc_type: string }> = [];
  if (idDocFile && idDocFile.size > 0) docsToUpload.push({ file: idDocFile, doc_type: "id" });
  if (payslipFile && payslipFile.size > 0) docsToUpload.push({ file: payslipFile, doc_type: "payslip" });
  if (bankFile && bankFile.size > 0) docsToUpload.push({ file: bankFile, doc_type: "bank_statement" });

  for (const item of docsToUpload) {
    const bytes = await item.file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const ext = item.file.name.split(".").pop() ?? "pdf";
    const path = `${app.id}/${item.doc_type}-${Date.now()}.${ext}`;

    await supabase.storage.from("documents").upload(path, buffer, { contentType: item.file.type, upsert: true });

    await admin.from("documents").insert({
      tenant_id: user.tenant_id!,
      entity_type: "application",
      entity_id: app.id,
      doc_type: item.doc_type,
      file_path: path,
      sha256_hash: sha256,
      status: "pending",
      uploaded_by: user.id,
    });
  }

  // 6. Record Unbundled Consents (FR-CONSENT-01)
  const consentCredit = formData.get("consent_credit_assessment") === "on";
  const consentBureau = formData.get("consent_bureau") === "on";
  const consentDebt = formData.get("consent_debt_collection") === "on";
  const consentMarketing = formData.get("consent_marketing") === "on";

  await admin.from("consents").insert([
    {
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      application_id: app.id,
      consent_type: "credit_assessment",
      granted: consentCredit,
      channel: "borrower_portal",
      granted_at: consentCredit ? new Date().toISOString() : null,
      recorded_by: user.id,
    },
    {
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      application_id: app.id,
      consent_type: "bureau_enquiry_and_submission",
      granted: consentBureau,
      channel: "borrower_portal",
      granted_at: consentBureau ? new Date().toISOString() : null,
      recorded_by: user.id,
    },
    {
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      application_id: app.id,
      consent_type: "debt_collection_disclosure",
      granted: consentDebt,
      channel: "borrower_portal",
      granted_at: consentDebt ? new Date().toISOString() : null,
      recorded_by: user.id,
    },
    {
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      application_id: app.id,
      consent_type: "marketing",
      granted: consentMarketing,
      channel: "borrower_portal",
      granted_at: consentMarketing ? new Date().toISOString() : null,
      recorded_by: user.id,
    },
    {
      tenant_id: user.tenant_id!,
      applicant_id: applicant.id,
      application_id: app.id,
      consent_type: "cession_disclosure",
      granted: true,
      channel: "borrower_portal",
      granted_at: new Date().toISOString(),
      recorded_by: user.id,
    },
  ]);

  revalidatePath("/portal");
  redirect("/portal");
}
