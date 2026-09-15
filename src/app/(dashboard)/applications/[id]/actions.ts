"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/current-staff";
import { canDecide, canDisburse, canIntake, canReviewDocuments } from "@/lib/roles";
import { runAssessment, EXPENDITURE_LINE_CODES } from "@/lib/rules-engine/engine";
import type { AssessmentInput, PolicyParams } from "@/lib/rules-engine/types";
import type { ApplicationStatus } from "@/types/database";
import { createHash } from "crypto";

function revalidate(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
}

// ---------------------------------------------------------------------------
// 4.1 Employment / Credit History / Bank Details
// ---------------------------------------------------------------------------

export async function saveEmployment(applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const payload = {
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    employer_name: String(formData.get("employer_name") ?? ""),
    employer_address: String(formData.get("employer_address") ?? "") || null,
    occupation: String(formData.get("occupation") ?? "") || null,
    monthly_net_salary: formData.get("monthly_net_salary") ? Number(formData.get("monthly_net_salary")) : null,
    employment_start_date: String(formData.get("employment_start_date") ?? "") || null,
    employer_phone: String(formData.get("employer_phone") ?? "") || null,
    employer_contact: String(formData.get("employer_contact") ?? "") || null,
    employer_email: String(formData.get("employer_email") ?? "") || null,
  };

  const { data: existing } = await supabase.from("employment").select("id").eq("application_id", applicationId).maybeSingle();
  if (existing) {
    await supabase.from("employment").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("employment").insert(payload);
  }
  revalidate(applicationId);
}

export async function addCreditHistoryRow(applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  await supabase.from("credit_history").insert({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    lender_name: String(formData.get("lender_name") ?? ""),
    monthly_instalment: Number(formData.get("monthly_instalment") ?? 0),
    amount_outstanding: formData.get("amount_outstanding") ? Number(formData.get("amount_outstanding")) : null,
    expected_repayment_date: String(formData.get("expected_repayment_date") ?? "") || null,
  });
  revalidate(applicationId);
}

export async function removeCreditHistoryRow(applicationId: string, rowId: string) {
  const staff = await requireStaff();
  if (!canIntake(staff.role)) throw new Error("Not permitted");
  const supabase = await createClient();
  await supabase.from("credit_history").delete().eq("id", rowId);
  revalidate(applicationId);
}

export async function saveBankDetails(applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const accountNumber = String(formData.get("account_number") ?? "");
  const { data: token, error: tokenError } = await supabase.rpc("tokenize_secure_value", {
    p_tenant_id: staff.tenant_id,
    p_field_type: "account_number",
    p_plaintext: accountNumber,
  });
  if (tokenError) throw new Error(tokenError.message);

  const payload = {
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    bank_name: String(formData.get("bank_name") ?? ""),
    account_name: String(formData.get("account_name") ?? ""),
    branch: String(formData.get("branch") ?? "") || null,
    account_number_token: token,
  };

  const { data: existing } = await supabase.from("bank_details").select("id").eq("application_id", applicationId).maybeSingle();
  if (existing) {
    await supabase.from("bank_details").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("bank_details").insert(payload);
  }
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.3 Income & Expenditure — one row per line, upserted from a single form submit.
// ---------------------------------------------------------------------------

export async function saveIncomeExpenditure(applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const lineCodes = [
    "INC_BASIC", "INC_BENEFITS", "INC_RENTAL", "INC_DEDUCT", "INC_SPOUSE_GROSS", "INC_SPOUSE_DEDUCT", "INC_OTHER",
    ...EXPENDITURE_LINE_CODES,
  ];

  const rows = lineCodes.map((line_code) => ({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    line_code,
    amount: Number(formData.get(line_code) ?? 0) || 0,
    source: "declared" as const,
  }));

  const { error } = await supabase.from("income_expenditure").upsert(rows, { onConflict: "application_id,line_code" });
  if (error) throw new Error(error.message);
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// Application lifecycle transitions (FR-APP-05 / §4.1.1)
// ---------------------------------------------------------------------------

export async function transitionApplication(applicationId: string, status: ApplicationStatus) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status }).eq("id", applicationId);
  if (error) throw new Error(error.message);
  void staff;
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.4 Run the deterministic affordability & rules engine (FR-ENG-*)
// ---------------------------------------------------------------------------

export async function runApplicationAssessment(applicationId: string) {
  const staff = await requireStaff();
  if (!staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const { data: application } = await supabase.from("applications").select("*").eq("id", applicationId).single();
  if (!application) throw new Error("Application not found");

  const [{ data: applicant }, { data: lines }, { data: creditHistory }, { data: documents },
    { data: policyParamRows }, { data: otherLive }] = await Promise.all([
    supabase.from("applicants").select("*").eq("id", application.applicant_id).single(),
    supabase.from("income_expenditure").select("line_code, amount").eq("application_id", applicationId),
    supabase.from("credit_history").select("monthly_instalment").eq("application_id", applicationId),
    supabase.from("documents").select("doc_type, status").eq("entity_type", "application").eq("entity_id", applicationId),
    supabase.from("policy_params").select("param_key, param_value, effective_from").eq("tenant_id", staff.tenant_id).lte("effective_from", new Date().toISOString().slice(0, 10)).order("effective_from", { ascending: false }),
    supabase.from("applications").select("id").eq("applicant_id", application.applicant_id).neq("id", applicationId).not("status", "in", "(settled,declined,withdrawn,handed_over)"),
  ]);

  if (!applicant) throw new Error("Applicant not found");

  // Latest value per param_key (policy_params is append-only; take the most recent effective row).
  const latestParams = new Map<string, unknown>();
  for (const row of policyParamRows ?? []) {
    if (!latestParams.has(row.param_key)) latestParams.set(row.param_key, row.param_value);
  }
  const num = (key: string, fallback: number) => {
    const v = latestParams.get(key);
    return typeof v === "number" ? v : v != null ? Number(v) : fallback;
  };

  const params: PolicyParams = {
    loan_ceiling_nad: num("loan_ceiling_nad", 100000),
    term_ceiling_months: num("term_ceiling_months", 60),
    finance_charge_cap_short_term_months: num("finance_charge_cap_short_term_months", 5),
    finance_charge_cap_short_pct: num("finance_charge_cap_short_pct", 0.30),
    finance_charge_cap_long_prime_multiplier: num("finance_charge_cap_long_prime_multiplier", 2),
    prime_rate_pct: num("prime_rate_pct", 0.1075),
    penalty_cap_pct: num("penalty_cap_pct", 0.30),
    penalty_duration_days: num("penalty_duration_days", 90),
    alpha_instalment_coverage: num("alpha_instalment_coverage", 0.60),
    beta_dsr_ceiling: num("beta_dsr_ceiling", 0.35),
    min_living_allowance_nad: num("min_living_allowance_nad", 1500),
    income_variance_threshold_pct: num("income_variance_threshold_pct", 0.10),
    expenditure_plausibility_min_pct: num("expenditure_plausibility_min_pct", 0.40),
  };

  const lineMap: Record<string, number> = {};
  for (const l of lines ?? []) lineMap[l.line_code] = Number(l.amount);

  const docTypes = new Set((documents ?? []).filter((d) => d.status === "reviewed_accepted").map((d) => d.doc_type));
  const payslipDoc = (documents ?? []).find((d) => d.doc_type === "payslip");

  const input: AssessmentInput = {
    amountRequested: Number(application.amount_requested),
    termMonths: application.term_months,
    productType: application.product_type,
    nextPayDate: application.next_pay_date,
    applicationSubmittedDate: application.created_at.slice(0, 10),
    maritalStatus: applicant.marital_status,
    dependantsCount: applicant.dependants_count,
    lines: lineMap as AssessmentInput["lines"],
    creditHistory: (creditHistory ?? []).map((c) => ({ monthlyInstalment: Number(c.monthly_instalment) })),
    evidence: {
      idAccepted: docTypes.has("id"),
      payslipAvailable: !!payslipDoc,
      payslipAcceptedOrAlternativeAgreed: docTypes.has("payslip") || docTypes.has("alternative_income_evidence"),
      bankStatementAccepted: docTypes.has("bank_statement"),
    },
    incomeVarianceKnown: false,
    declaredVsEvidencedVariancePct: null,
    hasOtherLiveApplication: (otherLive?.length ?? 0) > 0,
    bureauSubmissionAttempted: false,
    bureauConsentRecorded: false,
  };

  const result = runAssessment(input, params);

  const { data: assessment, error } = await supabase.from("assessments").insert({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    engine_version: result.engineVersion,
    policy_params_snapshot: params,
    computed_a: result.figures.A,
    computed_b: result.figures.B,
    computed_c: result.figures.C,
    computed_d: result.figures.D,
    computed_e: result.figures.E,
    computed_s: result.figures.S,
    computed_o: result.figures.O,
    computed_i: result.figures.I,
    computed_dsr: result.figures.DSR,
    max_affordable_principal: result.maxAffordablePrincipal,
    rules_passed: result.rulesPassed,
    rules_failed: result.rulesFailed,
    rules_flagged: result.rulesFlagged,
    binding_constraint: result.bindingConstraint?.id ?? null,
    created_by: staff.id,
  }).select("id").single();

  if (error || !assessment) throw new Error(error?.message ?? "Could not save assessment");

  await supabase.from("applications").update({ status: "assessed" }).eq("id", applicationId);
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.5 Decision (append-only) (FR-DEC-*)
// ---------------------------------------------------------------------------

const decisionSchema = z.object({
  outcome: z.enum(["approved", "approved_with_changes", "declined"]),
  amount_approved: z.coerce.number().optional(),
  term_approved: z.coerce.number().int().optional(),
  reason_code: z.string().min(1),
  notes: z.string().optional(),
});

export async function recordDecision(applicationId: string, assessmentId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canDecide(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const parsed = decisionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  const { data: assessment } = await supabase.from("assessments").select("rules_failed").eq("id", assessmentId).single();
  const rulesFailed = (assessment?.rules_failed as Array<{ type: string }> | null) ?? [];
  const hasRegulatoryFailure = rulesFailed.some((r) => r.type === "Regulatory");

  if (hasRegulatoryFailure && data.outcome !== "declined") {
    throw new Error("A regulatory rule failed — only 'declined' is available (FR-ENG-03/FR-DEC-03).");
  }

  const isOverride = data.outcome !== "declined" && rulesFailed.length > 0;

  const { error } = await supabase.from("decisions").insert({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    assessment_id: assessmentId,
    outcome: data.outcome,
    amount_approved: data.outcome === "declined" ? null : data.amount_approved,
    term_approved: data.outcome === "declined" ? null : data.term_approved,
    reason_code: data.reason_code,
    notes: data.notes || null,
    is_override: isOverride,
    decided_by: staff.id,
  });
  if (error) throw new Error(error.message);

  await supabase.from("applications").update({ status: data.outcome }).eq("id", applicationId);
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.6 Agreement generation (FR-AGR-*)
// ---------------------------------------------------------------------------

export async function generateAgreement(applicationId: string, decisionId: string) {
  const staff = await requireStaff();
  if (!canDecide(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const [{ data: decision }, { data: application }, { data: activeTemplate }] = await Promise.all([
    supabase.from("decisions").select("*").eq("id", decisionId).single(),
    supabase.from("applications").select("*").eq("id", applicationId).single(),
    supabase.from("agreement_templates").select("*").eq("tenant_id", staff.tenant_id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!decision || !application) throw new Error("Decision or application not found");
  if (!activeTemplate || !activeTemplate.attorney_reviewed) {
    throw new Error("No attorney-reviewed active agreement template is configured (FR-AGR-08). Ask an admin to activate one under Policy Parameters.");
  }

  const principal = Number(decision.amount_approved ?? application.amount_requested);
  const { data: params } = await supabase.from("policy_params").select("param_key, param_value").eq("tenant_id", staff.tenant_id).lte("effective_from", new Date().toISOString().slice(0, 10)).order("effective_from", { ascending: false });
  const latest = new Map<string, unknown>();
  for (const p of params ?? []) if (!latest.has(p.param_key)) latest.set(p.param_key, p.param_value);
  const shortCapPct = Number(latest.get("finance_charge_cap_short_pct") ?? 0.30);
  const shortTermMonths = Number(latest.get("finance_charge_cap_short_term_months") ?? 5);
  const primeRate = Number(latest.get("prime_rate_pct") ?? 0.1075);
  const primeMultiplier = Number(latest.get("finance_charge_cap_long_prime_multiplier") ?? 2);

  const term = decision.term_approved ?? application.term_months;
  const isShortTerm = term <= shortTermMonths;
  const financeCharge = isShortTerm
    ? Math.round(principal * shortCapPct * 100) / 100
    : Math.round(principal * primeRate * primeMultiplier * (term / 12) * 100) / 100;
  const totalRepayable = Math.round((principal + financeCharge) * 100) / 100;

  // FR-AGR-03: hard block — total finance charge (however labelled) may never exceed the cap.
  const capAmount = isShortTerm ? principal * shortCapPct : principal * primeRate * primeMultiplier * (term / 12);
  if (financeCharge > capAmount + 0.01) {
    throw new Error("Computed finance charge exceeds the regulatory cap — agreement blocked (FR-AGR-03).");
  }

  const schedule = isShortTerm
    ? [{ instalment_number: 1, due_date: application.next_pay_date, amount_due: totalRepayable }]
    : Array.from({ length: term }, (_, i) => ({
        instalment_number: i + 1,
        amount_due: Math.round((totalRepayable / term) * 100) / 100,
      }));

  const { data: referenceNumber } = await supabase.rpc("next_reference_number", {
    p_tenant_id: staff.tenant_id,
    p_seq_type: "agreement",
    p_prefix: "AGR-",
  });

  const documentText = `LOAN AGREEMENT ${referenceNumber}\nPrincipal: N$${principal.toFixed(2)}\nFinance charge: N$${financeCharge.toFixed(2)}\nTotal repayable: N$${totalRepayable.toFixed(2)}\nTemplate: ${activeTemplate.name} v${activeTemplate.version}`;
  const pdfHash = createHash("sha256").update(documentText).digest("hex");

  const { data: agreement, error } = await supabase.from("agreements").insert({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    decision_id: decisionId,
    template_id: activeTemplate.id,
    reference_number: referenceNumber ?? `AGR-${Date.now()}`,
    principal,
    finance_charge: financeCharge,
    total_repayable: totalRepayable,
    instalment_schedule: schedule,
    pdf_sha256_hash: pdfHash,
    generated_by: staff.id,
  }).select("id").single();

  if (error || !agreement) throw new Error(error?.message ?? "Could not generate agreement");

  await supabase.from("applications").update({ status: "agreement_generated" }).eq("id", applicationId);
  revalidate(applicationId);
}

export async function recordAcceptance(applicationId: string, agreementId: string, formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: agreement } = await supabase.from("agreements").select("pdf_sha256_hash").eq("id", agreementId).single();

  const acceptanceMethod = formData.get("acceptance_method") === "signed_photo" ? "signed_photo" : "device_signature";

  const { error } = await supabase.from("agreements").update({
    acceptance_method: acceptanceMethod,
    acceptance_timestamp: new Date().toISOString(),
    acceptance_document_hash: agreement?.pdf_sha256_hash ?? null,
    acceptance_ip: String(formData.get("acceptance_ip") ?? ""),
  }).eq("id", agreementId);
  if (error) throw new Error(error.message);

  await supabase.from("applications").update({ status: "agreement_accepted" }).eq("id", applicationId);
  void staff;
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.7 Disbursement (FR-DISB-*)
// ---------------------------------------------------------------------------

export async function recordDisbursement(applicationId: string, agreementId: string, decidedBy: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canDisburse(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const { data: agreement } = await supabase.from("agreements").select("principal, instalment_schedule").eq("id", agreementId).single();
  if (!agreement) throw new Error("Agreement not found");

  const roleSwitch = formData.get("role_switch_acknowledged") === "on";

  const { data: loan, error } = await supabase.from("loans").insert({
    tenant_id: staff.tenant_id,
    application_id: applicationId,
    agreement_id: agreementId,
    decided_by: decidedBy,
    disbursed_amount: agreement.principal,
    disbursement_method: String(formData.get("disbursement_method") ?? ""),
    disbursement_reference: String(formData.get("disbursement_reference") ?? ""),
    disbursed_by: staff.id,
    role_switch_acknowledged: roleSwitch,
    role_switch_reason: roleSwitch ? String(formData.get("role_switch_reason") ?? "") : null,
  }).select("id").single();

  if (error || !loan) throw new Error(error?.message ?? "Could not record disbursement");

  const scheduleRows = (agreement.instalment_schedule as Array<{ instalment_number: number; due_date?: string; amount_due: number }>) ?? [];
  if (scheduleRows.length) {
    await supabase.from("schedules").insert(
      scheduleRows.map((s) => ({
        tenant_id: staff.tenant_id,
        loan_id: loan.id,
        instalment_number: s.instalment_number,
        due_date: s.due_date ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        amount_due: s.amount_due,
      })),
    );
  }

  await supabase.from("applications").update({ status: "disbursed" }).eq("id", applicationId);
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.8 Repayments (FR-REPAY-*)
// ---------------------------------------------------------------------------

export async function recordRepayment(applicationId: string, loanId: string, scheduleId: string, amountDue: number, formData: FormData) {
  const staff = await requireStaff();
  if (!canDisburse(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const amountPaid = Number(formData.get("amount_paid") ?? 0);
  const paidDate = String(formData.get("paid_date") ?? "");
  const variance = Math.round((amountPaid - amountDue) * 100) / 100;

  const { error } = await supabase.from("repayments").insert({
    tenant_id: staff.tenant_id,
    schedule_id: scheduleId,
    loan_id: loanId,
    amount_paid: amountPaid,
    paid_date: paidDate,
    reference: String(formData.get("reference") ?? "") || null,
    variance,
    recorded_by: staff.id,
  });
  if (error) throw new Error(error.message);

  const newStatus = variance >= 0 ? "paid" : "partial";
  await supabase.from("schedules").update({ status: newStatus }).eq("id", scheduleId);

  const { data: openSchedules } = await supabase.from("schedules").select("id").eq("loan_id", loanId).in("status", ["due", "partial", "missed"]);
  if (!openSchedules || openSchedules.length === 0) {
    await supabase.from("loans").update({ status: "settled" }).eq("id", loanId);
    await supabase.from("applications").update({ status: "settled" }).eq("id", applicationId);
  }

  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// 4.10 Consents (FR-CONSENT-*)
// ---------------------------------------------------------------------------

const CONSENT_TYPES = ["credit_assessment", "bureau_enquiry_and_submission", "debt_collection_disclosure", "marketing", "cession_disclosure"] as const;

export async function saveConsents(applicantId: string, applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  for (const type of CONSENT_TYPES) {
    const granted = formData.get(`consent_${type}`) === "on";
    await supabase.from("consents").insert({
      tenant_id: staff.tenant_id,
      applicant_id: applicantId,
      application_id: applicationId,
      consent_type: type,
      granted,
      channel: "in_person",
      granted_at: granted ? new Date().toISOString() : null,
      recorded_by: staff.id,
    });
  }
  revalidate(applicationId);
}

// ---------------------------------------------------------------------------
// Document upload (FR-DOC-01/02) — hashed on receipt, stored via the shared document store.
// ---------------------------------------------------------------------------

export async function uploadDocument(applicationId: string, formData: FormData) {
  const staff = await requireStaff();
  if (!canIntake(staff.role) || !staff.tenant_id) throw new Error("Not permitted");
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  const docType = String(formData.get("doc_type") ?? "");
  if (!file || !docType) throw new Error("A file and document type are required");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${staff.tenant_id}/application/${applicationId}/${docType}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("documents").insert({
    tenant_id: staff.tenant_id,
    entity_type: "application",
    entity_id: applicationId,
    doc_type: docType,
    file_path: path,
    sha256_hash: hash,
    uploaded_by: staff.id,
  });
  if (error) throw new Error(error.message);
  revalidate(applicationId);
}

export async function getDocumentSignedUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 300); // 5 min (FR-CORE-12)
  if (error || !data) throw new Error(error?.message ?? "Could not create signed URL");
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Document review (FR-DOC-04)
// ---------------------------------------------------------------------------

export async function reviewDocument(applicationId: string, documentId: string, status: "reviewed_accepted" | "rejected", notes: string) {
  const staff = await requireStaff();
  if (!canReviewDocuments(staff.role)) throw new Error("Not permitted");
  const supabase = await createClient();

  const { error } = await supabase.from("documents").update({
    status,
    review_notes: notes || null,
    reviewed_by: staff.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidate(applicationId);
}
