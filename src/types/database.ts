// Hand-written types mirroring supabase/migrations/*.sql. Once the project is linked to a
// live Supabase instance, prefer regenerating this file with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// Row types are accurate; Insert/Update are intentionally loose (Partial<Row>) for build
// velocity in this first pass — tighten once the UI's real write shapes have settled.

export type StaffRole = "super_admin" | "admin" | "intake" | "officer" | "approver" | "finance";
export type PlatformRole = "super_admin" | "tenant_user";

export type ApplicationStatus =
  | "draft" | "submitted" | "under_review" | "awaiting_documents" | "assessed"
  | "approved" | "approved_with_changes" | "declined" | "withdrawn"
  | "agreement_generated" | "agreement_accepted" | "disbursed" | "performing"
  | "in_arrears" | "settled" | "handed_over";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  namfisa_reg_number: string | null;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
};

export type UserRow = {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  platform_role: PlatformRole;
  role: StaffRole;
  status: "active" | "inactive";
  mfa_enrolled: boolean;
  created_at: string;
  updated_at: string;
};

export type PolicyParamRow = {
  id: string;
  tenant_id: string;
  param_key: string;
  param_value: unknown;
  effective_from: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type ApplicantRow = {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  full_name: string;
  sex: "M" | "F" | null;
  id_type: "personal_id" | "passport";
  id_number_token: string;
  id_number_hash: string;
  document_number_token: string | null;
  mobile: string;
  email: string | null;
  residential_address: string;
  marital_status: "single" | "married_in_cop" | "married_out_of_cop";
  dependants_count: number;
  next_of_kin_name: string;
  next_of_kin_mobile: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  tenant_id: string;
  applicant_id: string;
  reference_number: string;
  amount_requested: number;
  next_pay_date: string | null;
  term_months: number;
  product_type: "once_off" | "instalment";
  purpose_category: string | null;
  purpose_text: string | null;
  referral_source: string | null;
  has_prior_credit: "no" | "had" | "have" | null;
  status: ApplicationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationOverrideRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  override_type: "duplicate_application";
  reason_code: string;
  notes: string | null;
  overridden_by: string;
  created_at: string;
};

export type EmploymentRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  employer_name: string;
  employer_address: string | null;
  occupation: string | null;
  monthly_net_salary: number | null;
  employment_start_date: string | null;
  employer_phone: string | null;
  employer_contact: string | null;
  employer_email: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditHistoryRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  lender_name: string;
  monthly_instalment: number;
  amount_outstanding: number | null;
  expected_repayment_date: string | null;
  created_at: string;
};

export type BankDetailsRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  bank_name: string;
  account_name: string;
  branch: string | null;
  account_number_token: string;
  created_at: string;
};

export type IncomeExpenditureRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  line_code: string;
  amount: number;
  source: "declared" | "payslip" | "bank_statement";
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  doc_type: string;
  file_path: string;
  sha256_hash: string;
  status: "pending" | "reviewed_accepted" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  uploaded_by: string | null;
  retention_expires_at: string | null;
  purged_at: string | null;
  created_at: string;
};

export type AssessmentRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  engine_version: string;
  policy_params_snapshot: unknown;
  computed_a: number | null;
  computed_b: number | null;
  computed_c: number | null;
  computed_d: number | null;
  computed_e: number | null;
  computed_s: number | null;
  computed_o: number | null;
  computed_i: number | null;
  computed_dsr: number | null;
  max_affordable_principal: number | null;
  rules_passed: unknown;
  rules_failed: unknown;
  rules_flagged: unknown;
  binding_constraint: string | null;
  created_by: string | null;
  created_at: string;
};

export type DecisionRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  assessment_id: string;
  outcome: "approved" | "approved_with_changes" | "declined";
  amount_approved: number | null;
  term_approved: number | null;
  reason_code: string;
  notes: string | null;
  is_override: boolean;
  supersedes_decision_id: string | null;
  decided_by: string;
  decided_at: string;
};

export type AgreementTemplateRow = {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  content: string;
  status: "draft" | "active" | "retired";
  includes_notary_clause: boolean;
  includes_cession_clause: boolean;
  attorney_reviewed: boolean;
  attorney_reviewed_by: string | null;
  attorney_reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type AgreementRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  decision_id: string;
  template_id: string;
  reference_number: string;
  principal: number;
  finance_charge: number;
  total_repayable: number;
  instalment_schedule: unknown;
  pdf_path: string | null;
  pdf_sha256_hash: string | null;
  generated_by: string | null;
  generated_at: string;
  acceptance_method: "device_signature" | "signed_photo" | null;
  acceptance_file_path: string | null;
  acceptance_ip: string | null;
  acceptance_timestamp: string | null;
  acceptance_document_hash: string | null;
  created_at: string;
};

export type LoanRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  agreement_id: string;
  decided_by: string;
  status: "disbursed" | "performing" | "in_arrears" | "settled" | "handed_over";
  disbursed_amount: number;
  disbursement_method: string;
  disbursement_reference: string;
  disbursed_by: string;
  disbursed_at: string;
  role_switch_acknowledged: boolean;
  role_switch_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleRow = {
  id: string;
  tenant_id: string;
  loan_id: string;
  instalment_number: number;
  due_date: string;
  amount_due: number;
  status: "due" | "paid" | "partial" | "missed";
  created_at: string;
  updated_at: string;
};

export type RepaymentRow = {
  id: string;
  tenant_id: string;
  schedule_id: string;
  loan_id: string;
  amount_paid: number;
  paid_date: string;
  reference: string | null;
  variance: number | null;
  recorded_by: string;
  created_at: string;
};

export type ArrearsEventRow = {
  id: string;
  tenant_id: string;
  loan_id: string;
  schedule_id: string | null;
  days_past_due: number;
  penalty_charged: number;
  status: "open" | "cured" | "handed_over";
  hand_over_required: boolean;
  created_at: string;
  updated_at: string;
};

export type BureauLookupRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  bureau_name: string;
  obligations_found: unknown;
  adverse_entries: unknown;
  lookup_date: string;
  recorded_by: string;
  created_at: string;
};

export type ConsentType =
  | "credit_assessment" | "bureau_enquiry_and_submission" | "debt_collection_disclosure"
  | "marketing" | "cession_disclosure";

export type ConsentRow = {
  id: string;
  tenant_id: string;
  applicant_id: string;
  application_id: string | null;
  consent_type: ConsentType;
  granted: boolean;
  channel: string | null;
  granted_at: string | null;
  withdrawn_at: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  tenant_id: string | null;
  actor_type: "human" | "agent" | "system";
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: unknown;
  after_state: unknown;
  prev_hash: string | null;
  record_hash: string;
  created_at: string;
};

// Matches the shape @supabase/postgrest-js's GenericTable expects (Row/Insert/Update PLUS
// Relationships) — omitting Relationships silently collapses every query's inferred type to
// `never` instead of raising a clear error, which is easy to lose an afternoon to.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      tenants: Table<TenantRow>;
      users: Table<UserRow>;
      policy_params: Table<PolicyParamRow>;
      applicants: Table<ApplicantRow>;
      applications: Table<ApplicationRow>;
      application_overrides: Table<ApplicationOverrideRow>;
      employment: Table<EmploymentRow>;
      credit_history: Table<CreditHistoryRow>;
      bank_details: Table<BankDetailsRow>;
      income_expenditure: Table<IncomeExpenditureRow>;
      documents: Table<DocumentRow>;
      assessments: Table<AssessmentRow>;
      decisions: Table<DecisionRow>;
      agreement_templates: Table<AgreementTemplateRow>;
      agreements: Table<AgreementRow>;
      loans: Table<LoanRow>;
      schedules: Table<ScheduleRow>;
      repayments: Table<RepaymentRow>;
      arrears_events: Table<ArrearsEventRow>;
      bureau_lookups: Table<BureauLookupRow>;
      consents: Table<ConsentRow>;
      audit_log: Table<AuditLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      hash_secure_value: { Args: { p_plaintext: string }; Returns: string };
      tokenize_secure_value: { Args: { p_tenant_id: string; p_field_type: string; p_plaintext: string }; Returns: string };
      reveal_secure_value: { Args: { p_token: string }; Returns: string };
      next_reference_number: { Args: { p_tenant_id: string; p_seq_type: string; p_prefix: string }; Returns: string };
      portal_default_tenant_id: { Args: Record<string, never>; Returns: string };
      portal_disclosure_params: { Args: { p_tenant_id: string }; Returns: Record<string, unknown> };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
