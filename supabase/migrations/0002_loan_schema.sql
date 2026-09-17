-- 0002_loan_schema.sql
-- Nexora Systems: Cash Loan Origination & Servicing Schema (Pilot Module 1)

-- 1. Applicants (The Person, distinct from any application, FR-APP-01/02)
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  sex text check (sex in ('M', 'F')),
  id_type text not null check (id_type in ('personal_id', 'passport')),
  id_number_token text not null,
  id_number_hash text not null,
  document_number_token text,
  mobile text not null,
  email text,
  residential_address text not null,
  marital_status text not null check (marital_status in ('single', 'married_in_cop', 'married_out_of_cop')),
  dependants_count integer not null default 0,
  next_of_kin_name text not null,
  next_of_kin_mobile text not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applicants_lookup on public.applicants(tenant_id, id_number_hash);

-- Add foreign key constraint to users(applicant_id) now that applicants exists
alter table public.users
  add constraint fk_users_applicant
  foreign key (applicant_id) references public.applicants(id) on delete set null;

-- 2. Applications (Finite State Machine, FR-APP-03/05/§4.1.1)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  reference_number text not null,
  amount_requested numeric(12,2) not null check (amount_requested > 0 and amount_requested <= 100000),
  next_pay_date date,
  term_months integer not null check (term_months >= 1 and term_months <= 60),
  product_type text not null default 'once_off' check (product_type in ('once_off', 'instalment')),
  purpose_category text,
  purpose_text text,
  referral_source text,
  has_prior_credit text check (has_prior_credit in ('no', 'had', 'have')),
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'under_review', 'awaiting_documents', 'assessed',
    'approved', 'approved_with_changes', 'declined', 'withdrawn',
    'agreement_generated', 'agreement_accepted', 'disbursed', 'performing',
    'in_arrears', 'settled', 'handed_over'
  )),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, reference_number)
);

create index if not exists idx_applications_applicant on public.applications(applicant_id);
create index if not exists idx_applications_status on public.applications(tenant_id, status);

-- 3. Application Overrides (FR-APP-04, concurrency override)
create table if not exists public.application_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  override_type text not null,
  reason_code text not null,
  notes text,
  overridden_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- 4. Employment Snapshot (FR-APP-06)
create table if not exists public.employment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade unique,
  employer_name text not null,
  employer_address text,
  occupation text,
  monthly_net_salary numeric(12,2),
  employment_start_date date,
  employer_phone text,
  employer_contact text,
  employer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Credit History (Prior obligations, FR-APP-07)
create table if not exists public.credit_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  lender_name text not null,
  monthly_instalment numeric(12,2) not null,
  amount_outstanding numeric(12,2),
  expected_repayment_date date,
  created_at timestamptz not null default now()
);

-- 6. Bank Details (Tokenised collection account, FR-APP-08 / NFR-SEC-01)
create table if not exists public.bank_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade unique,
  bank_name text not null,
  account_name text not null,
  branch text,
  account_number_token text not null,
  created_at timestamptz not null default now()
);

-- 7. Income & Expenditure (25 lines from Page 2 of paper form, FR-INC-01/03)
create table if not exists public.income_expenditure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  line_code text not null,
  amount numeric(12,2) not null default 0,
  source text not null default 'declared' check (source in ('declared', 'payslip', 'bank_statement')),
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, line_code)
);

-- 8. Documents (Generic Document Store, FR-CORE-10/11/12, FR-DOC-01/02/04)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null default 'application',
  entity_id text not null,
  doc_type text not null,
  file_path text not null,
  sha256_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed_accepted', 'rejected')),
  review_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  uploaded_by uuid references public.users(id),
  retention_expires_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_entity on public.documents(entity_type, entity_id);

-- 9. Extractions (Reserved Layer-3 Staging Table, FR-CORE-51)
create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  model text not null,
  model_version text not null,
  prompt_hash text not null,
  raw_output text not null,
  parsed_json jsonb,
  confidence numeric(4,3),
  accepted_by uuid references public.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 10. Assessments (Deterministic Affordability Result, FR-ENG-01–07)
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  engine_version text not null,
  policy_params_snapshot jsonb not null,
  computed_a numeric(12,2),
  computed_b numeric(12,2),
  computed_c numeric(12,2),
  computed_d numeric(12,2),
  computed_e numeric(12,2),
  computed_s numeric(12,2),
  computed_o numeric(12,2),
  computed_i numeric(12,2),
  computed_dsr numeric(6,4),
  max_affordable_principal numeric(12,2),
  rules_passed jsonb not null default '[]'::jsonb,
  rules_failed jsonb not null default '[]'::jsonb,
  rules_flagged jsonb not null default '[]'::jsonb,
  binding_constraint text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- 11. Decisions (Append-Only Credit Decision, FR-DEC-01–06)
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  outcome text not null check (outcome in ('approved', 'approved_with_changes', 'declined')),
  amount_approved numeric(12,2),
  term_approved integer,
  reason_code text not null,
  notes text,
  is_override boolean not null default false,
  supersedes_decision_id uuid references public.decisions(id),
  decided_by uuid not null references public.users(id),
  decided_at timestamptz not null default now()
);

-- 12. Agreement Templates (FR-AGR-01/05/08)
create table if not exists public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  version text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  includes_notary_clause boolean not null default false,
  includes_cession_clause boolean not null default true,
  attorney_reviewed boolean not null default false,
  attorney_reviewed_by text,
  attorney_reviewed_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- 13. Agreements (The Executed Contract, FR-AGR-01–07)
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  decision_id uuid not null references public.decisions(id) on delete cascade,
  template_id uuid not null references public.agreement_templates(id) on delete cascade,
  reference_number text not null,
  principal numeric(12,2) not null,
  finance_charge numeric(12,2) not null,
  total_repayable numeric(12,2) not null,
  instalment_schedule jsonb not null default '[]'::jsonb,
  pdf_path text,
  pdf_sha256_hash text,
  generated_by uuid references public.users(id),
  generated_at timestamptz not null default now(),
  acceptance_method text check (acceptance_method in ('device_signature', 'signed_photo')),
  acceptance_file_path text,
  acceptance_ip text,
  acceptance_timestamp timestamptz,
  acceptance_document_hash text,
  created_at timestamptz not null default now()
);

-- 14. Loans (The Live Facility, FR-DISB-01–04)
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade unique,
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  decided_by uuid not null references public.users(id),
  status text not null default 'disbursed' check (status in ('disbursed', 'performing', 'in_arrears', 'settled', 'handed_over')),
  disbursed_amount numeric(12,2) not null,
  disbursement_method text not null,
  disbursement_reference text not null,
  disbursed_by uuid not null references public.users(id),
  disbursed_at timestamptz not null default now(),
  role_switch_acknowledged boolean not null default false,
  role_switch_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. Schedules (Expected Repayments, FR-REPAY-01)
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  instalment_number integer not null,
  due_date date not null,
  amount_due numeric(12,2) not null,
  status text not null default 'due' check (status in ('due', 'paid', 'partial', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. Repayments (Actual Money Recorded, FR-REPAY-02)
create table if not exists public.repayments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  amount_paid numeric(12,2) not null,
  paid_date date not null,
  reference text,
  variance numeric(12,2),
  recorded_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- 17. Arrears Events (90-day penalty cap stop, FR-REPAY-03/04)
create table if not exists public.arrears_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete cascade,
  days_past_due integer not null default 0,
  penalty_charged numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open', 'cured', 'handed_over')),
  hand_over_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 18. Bureau Lookups (FR-BUR-01)
create table if not exists public.bureau_lookups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  bureau_name text not null,
  obligations_found jsonb not null default '[]'::jsonb,
  adverse_entries jsonb not null default '[]'::jsonb,
  lookup_date date not null,
  recorded_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- 19. Consents (Unbundled, FR-CONSENT-01–03)
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  consent_type text not null check (consent_type in (
    'credit_assessment', 'bureau_enquiry_and_submission',
    'debt_collection_disclosure', 'marketing', 'cession_disclosure'
  )),
  granted boolean not null default false,
  channel text default 'paper_form',
  granted_at timestamptz,
  withdrawn_at timestamptz,
  recorded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_consents_applicant on public.consents(applicant_id, consent_type);
