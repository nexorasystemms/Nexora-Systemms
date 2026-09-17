-- 0001_core_schema.sql
-- Nexora Systems: Multi-Tenancy Core, Users, Policy Parameters, and Audit Log

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Tenants (Multi-Tenancy FR-CORE-01)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  namfisa_reg_number text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Users (Staff & Borrowers, FR-CORE-02)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  applicant_id uuid, -- linked applicant profile for borrowers
  email text not null,
  full_name text not null,
  phone text,
  platform_role text not null default 'tenant_user' check (platform_role in ('super_admin', 'tenant_user')),
  role text not null check (role in ('super_admin', 'admin', 'intake', 'officer', 'approver', 'finance', 'borrower')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_tenant on public.users(tenant_id);
create index if not exists idx_users_applicant on public.users(applicant_id);

-- 3. Policy Parameters (Dated Versioning, FR-CORE-40/41/42)
create table if not exists public.policy_params (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  param_key text not null,
  param_value jsonb not null,
  effective_from date not null,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_policy_params_lookup on public.policy_params(tenant_id, param_key, effective_from desc);

-- 4. Audit Log (Append-Only, Hash-Chained, FR-CORE-20/21/22/23)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  prev_hash text,
  record_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_tenant on public.audit_log(tenant_id, created_at desc);
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
-- 0003_sequences.sql
-- Nexora Systems: Reference Number Generation Sequences

create table if not exists public.reference_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  seq_type text not null,
  current_val bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique(tenant_id, seq_type)
);

create or replace function public.next_reference_number(
  p_tenant_id uuid,
  p_seq_type text,
  p_prefix text
)
returns text
language plpgsql
security definer
as $$
declare
  v_next bigint;
  v_year text;
begin
  v_year := to_char(now(), 'YYYY');

  insert into public.reference_counters (tenant_id, seq_type, current_val, updated_at)
  values (p_tenant_id, p_seq_type, 1, now())
  on conflict (tenant_id, seq_type)
  do update set current_val = public.reference_counters.current_val + 1, updated_at = now()
  returning current_val into v_next;

  return p_prefix || v_year || '-' || lpad(v_next::text, 5, '0');
end;
$$;
-- 0004_rls_policies.sql
-- Nexora Systems: Row Level Security (RLS) for Tenant Isolation & Role Access

-- Enable RLS across all tables
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.policy_params enable row level security;
alter table public.audit_log enable row level security;
alter table public.applicants enable row level security;
alter table public.applications enable row level security;
alter table public.application_overrides enable row level security;
alter table public.employment enable row level security;
alter table public.credit_history enable row level security;
alter table public.bank_details enable row level security;
alter table public.income_expenditure enable row level security;
alter table public.documents enable row level security;
alter table public.extractions enable row level security;
alter table public.assessments enable row level security;
alter table public.decisions enable row level security;
alter table public.agreement_templates enable row level security;
alter table public.agreements enable row level security;
alter table public.loans enable row level security;
alter table public.schedules enable row level security;
alter table public.repayments enable row level security;
alter table public.arrears_events enable row level security;
alter table public.bureau_lookups enable row level security;
alter table public.consents enable row level security;
alter table public.reference_counters enable row level security;

-- Helper functions for RLS checks
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
as $$
  select tenant_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_applicant_id()
returns uuid
language sql
stable
security definer
as $$
  select applicant_id from public.users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((platform_role = 'super_admin'), false) from public.users where id = auth.uid();
$$;

-- 1. Tenants Policies
create policy "Staff can view their own tenant" on public.tenants
  for select using (id = public.current_tenant_id() or public.is_super_admin());

create policy "Super admin can manage tenants" on public.tenants
  for all using (public.is_super_admin());

-- 2. Users Policies
create policy "Users can view users in same tenant" on public.users
  for select using (
    id = auth.uid()
    or (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or public.is_super_admin()
  );

create policy "Staff admin can manage users in tenant" on public.users
  for all using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'super_admin'))
    or public.is_super_admin()
  );

-- 3. Policy Params
create policy "Tenant users can view policy params" on public.policy_params
  for select using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "Admins can update policy params" on public.policy_params
  for insert with check (
    (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'super_admin'))
    or public.is_super_admin()
  );

-- 4. Audit Log (Append-only)
create policy "Staff can view audit log" on public.audit_log
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'approver', 'super_admin'))
    or public.is_super_admin()
  );

create policy "System can insert audit log" on public.audit_log
  for insert with check (true);

-- 5. Applicants
create policy "Staff can view applicants in tenant" on public.applicants
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or (id = public.current_applicant_id())
    or public.is_super_admin()
  );

create policy "Staff can insert applicants" on public.applicants
  for insert with check (
    tenant_id = public.current_tenant_id()
    or public.is_super_admin()
  );

create policy "Staff can update applicants" on public.applicants
  for update using (
    tenant_id = public.current_tenant_id()
    or public.is_super_admin()
  );

-- 6. Applications
create policy "View applications" on public.applications
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or (applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );

create policy "Staff can manage applications" on public.applications
  for all using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or public.is_super_admin()
  );

-- 7. Application Details (Employment, Credit History, Bank Details, Income/Expenditure)
create policy "View employment" on public.employment
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage employment" on public.employment
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View credit_history" on public.credit_history
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage credit_history" on public.credit_history
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View bank_details" on public.bank_details
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() in ('approver', 'finance', 'admin', 'super_admin'))
    or public.is_super_admin()
  );
create policy "Staff manage bank_details" on public.bank_details
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View income_expenditure" on public.income_expenditure
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage income_expenditure" on public.income_expenditure
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- 8. Documents
create policy "View documents" on public.documents
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or (entity_type = 'application' and entity_id in (select id::text from public.applications where applicant_id = public.current_applicant_id()))
    or public.is_super_admin()
  );

create policy "Borrower can insert documents" on public.documents
  for insert with check (
    (entity_type = 'application' and entity_id in (select id::text from public.applications where applicant_id = public.current_applicant_id()))
    or (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or public.is_super_admin()
  );

create policy "Staff update documents" on public.documents
  for update using (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- 9. Assessments & Decisions
create policy "View assessments" on public.assessments
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or public.is_super_admin()
  );
create policy "Staff manage assessments" on public.assessments
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View decisions" on public.decisions
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage decisions" on public.decisions
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- 10. Agreements & Templates
create policy "View agreement_templates" on public.agreement_templates
  for select using (tenant_id = public.current_tenant_id() or public.is_super_admin());
create policy "Staff manage agreement_templates" on public.agreement_templates
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View agreements" on public.agreements
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Manage agreements" on public.agreements
  for all using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );

-- 11. Loans, Schedules, Repayments, Arrears
create policy "View loans" on public.loans
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage loans" on public.loans
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View schedules" on public.schedules
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or loan_id in (select l.id from public.loans l join public.applications a on l.application_id = a.id where a.applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage schedules" on public.schedules
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View repayments" on public.repayments
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or loan_id in (select l.id from public.loans l join public.applications a on l.application_id = a.id where a.applicant_id = public.current_applicant_id())
    or public.is_super_admin()
  );
create policy "Staff manage repayments" on public.repayments
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "Staff manage arrears" on public.arrears_events
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- 12. Bureau Lookups & Consents
create policy "Staff manage bureau_lookups" on public.bureau_lookups
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy "View consents" on public.consents
  for select using (
    (tenant_id = public.current_tenant_id() and public.current_user_role() != 'borrower')
    or applicant_id = public.current_applicant_id()
    or public.is_super_admin()
  );
create policy "Staff manage consents" on public.consents
  for all using (tenant_id = public.current_tenant_id() or public.is_super_admin());
-- 0005_crypto_and_tokenisation.sql
-- Nexora Systems: T3 Data Tokenisation, Encryption at Rest, and HMAC Blind Indexing (NFR-SEC-01)

create table if not exists public.encryption_keys (
  id uuid primary key default gen_random_uuid(),
  key_name text not null unique,
  secret_key text not null,
  hmac_secret text not null,
  created_at timestamptz not null default now()
);

-- Seed default random keys if not present
insert into public.encryption_keys (key_name, secret_key, hmac_secret)
values (
  'primary',
  encode(gen_random_bytes(32), 'hex'),
  encode(gen_random_bytes(32), 'hex')
)
on conflict (key_name) do nothing;

create table if not exists public.secure_tokens (
  token text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  field_type text not null,
  encrypted_value bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_secure_tokens_tenant on public.secure_tokens(tenant_id, field_type);

-- 1. HMAC Blind Index for Deduplication without Cleartext Storage
create or replace function public.hash_secure_value(p_plaintext text)
returns text
language plpgsql
security definer
as $$
declare
  v_hmac_secret text;
begin
  if p_plaintext is null or trim(p_plaintext) = '' then
    return null;
  end if;

  select hmac_secret into v_hmac_secret from public.encryption_keys where key_name = 'primary' limit 1;
  if v_hmac_secret is null then
    v_hmac_secret := 'nexora-fallback-static-salt-2026';
  end if;

  return encode(hmac(lower(trim(p_plaintext))::bytea, v_hmac_secret::bytea, 'sha256'), 'hex');
end;
$$;

-- 2. Tokenize Sensitive Value (Encrypted at Rest with AES-256)
create or replace function public.tokenize_secure_value(
  p_tenant_id uuid,
  p_field_type text,
  p_plaintext text
)
returns text
language plpgsql
security definer
as $$
declare
  v_secret_key text;
  v_token text;
  v_encrypted bytea;
begin
  if p_plaintext is null or trim(p_plaintext) = '' then
    return null;
  end if;

  select secret_key into v_secret_key from public.encryption_keys where key_name = 'primary' limit 1;
  if v_secret_key is null then
    v_secret_key := 'nexora-fallback-encryption-key-2026';
  end if;

  v_token := 'tok_' || p_field_type || '_' || encode(gen_random_bytes(16), 'hex');
  v_encrypted := pgp_sym_encrypt(trim(p_plaintext), v_secret_key);

  insert into public.secure_tokens (token, tenant_id, field_type, encrypted_value)
  values (v_token, p_tenant_id, p_field_type, v_encrypted);

  return v_token;
end;
$$;

-- 3. Reveal Sensitive Value (Audited Unmasking, NFR-SEC-01)
create or replace function public.reveal_secure_value(p_token text)
returns text
language plpgsql
security definer
as $$
declare
  v_secret_key text;
  v_record record;
  v_decrypted text;
begin
  if p_token is null or trim(p_token) = '' then
    return null;
  end if;

  select secret_key into v_secret_key from public.encryption_keys where key_name = 'primary' limit 1;
  select * into v_record from public.secure_tokens where token = p_token;

  if not found then
    return null;
  end if;

  v_decrypted := pgp_sym_decrypt(v_record.encrypted_value, v_secret_key);

  -- Append to audit log (FR-CORE-20)
  insert into public.audit_log (
    tenant_id, actor_type, actor_id, action, entity_type, entity_id, record_hash
  ) values (
    v_record.tenant_id,
    'human',
    auth.uid(),
    'unmask_t3_token',
    'secure_token',
    p_token,
    encode(sha256((coalesce(auth.uid()::text, 'anon') || p_token || now()::text)::bytea), 'hex')
  );

  return v_decrypted;
end;
$$;
-- 0006_seed_policy_params.sql
-- Nexora Systems: Initial Tenant, Regulatory Caps, and Agreement Template Seeding

do $$
declare
  v_tenant_id uuid;
begin
  -- 1. Seed Pilot Tenant: TMU CashLoan CC
  insert into public.tenants (id, name, slug, namfisa_reg_number, status)
  values (
    'a0000000-0000-0000-0000-000000000001',
    'TMU CashLoan CC',
    'tmu-cashloan',
    '25/11/1138',
    'active'
  )
  on conflict (slug) do update set name = excluded.name
  returning id into v_tenant_id;

  if v_tenant_id is null then
    select id into v_tenant_id from public.tenants where slug = 'tmu-cashloan';
  end if;

  -- 2. Seed Policy Parameters (Dated Versioning, FR-CORE-40/41, Rules R-01 to R-15)
  insert into public.policy_params (tenant_id, param_key, param_value, effective_from, note)
  values
    (v_tenant_id, 'loan_ceiling_nad', '100000'::jsonb, '2026-01-01', 'R-01: Microlending Act max principal ceiling N$100,000'),
    (v_tenant_id, 'term_ceiling_months', '60'::jsonb, '2026-01-01', 'R-02: Microlending Act max term 60 months'),
    (v_tenant_id, 'finance_charge_cap_short_term_months', '5'::jsonb, '2026-01-01', 'R-03: Boundary for short-term once-off loans'),
    (v_tenant_id, 'finance_charge_cap_short_pct', '0.30'::jsonb, '2026-01-01', 'R-03: NAMFISA short term cap 30% of principal'),
    (v_tenant_id, 'finance_charge_cap_long_prime_multiplier', '2'::jsonb, '2026-01-01', 'R-04: Usury Act long-term cap 2x prime rate'),
    (v_tenant_id, 'prime_rate_pct', '0.1075'::jsonb, '2026-01-01', 'Bank of Namibia prevailing prime rate (10.75%)'),
    (v_tenant_id, 'penalty_cap_pct', '0.30'::jsonb, '2026-01-01', 'R-05: General Notice 263 default penalty ceiling 30%'),
    (v_tenant_id, 'penalty_duration_days', '90'::jsonb, '2026-01-01', 'R-06: General Notice 263 default interest stops at 90 days'),
    (v_tenant_id, 'alpha_instalment_coverage', '0.60'::jsonb, '2026-01-01', 'R-08: Max instalment as fraction of surplus (alpha = 0.60)'),
    (v_tenant_id, 'beta_dsr_ceiling', '0.35'::jsonb, '2026-01-01', 'R-09: Debt-service ratio ceiling (beta = 0.35)'),
    (v_tenant_id, 'min_living_allowance_nad', '1500'::jsonb, '2026-01-01', 'R-10: Minimum living allowance floor per dependant (N$1,500)'),
    (v_tenant_id, 'income_variance_threshold_pct', '0.10'::jsonb, '2026-01-01', 'R-12: Declared vs payslip variance flag threshold (10%)'),
    (v_tenant_id, 'expenditure_plausibility_min_pct', '0.40'::jsonb, '2026-01-01', 'R-13: Expenditure plausibility minimum fraction (40%)');

  -- 3. Seed Default Active Agreement Template (FR-AGR-01/05/08)
  insert into public.agreement_templates (
    tenant_id, name, version, content, status, includes_notary_clause, includes_cession_clause, attorney_reviewed, attorney_reviewed_by, attorney_reviewed_at
  ) values (
    v_tenant_id,
    'TMU Standard Personal Loan Agreement',
    '1.0',
    'PERSONAL LOAN AGREEMENT\n\nLender: TMU CashLoan CC (NAMFISA Reg: 25/11/1138)\nBorrower: {{applicant_name}}\nPrincipal: N${{principal}}\nTotal Finance Charge: N${{finance_charge}}\nTotal Repayable: N${{total_repayable}}\n\nRepayment Terms: Due on {{next_pay_date}}.\nExecution taking place in Windhoek, Namibia without requiring notary public intervention.',
    'active',
    false, -- FR-AGR-05: no unperformed notary public clause
    true,
    true,  -- FR-AGR-08: attorney reviewed gate
    'TMU Legal Advisor',
    now()
  );

end $$;

-- Instructions for bootstrapping first Super Admin (Nexora):
-- 1. Create a user in Supabase Auth (Authentication -> Users -> Add user).
-- 2. Run the query below with that user's Auth UUID:
/*
insert into public.users (
  id, tenant_id, email, full_name, platform_role, role, status
) values (
  '<YOUR-SUPABASE-AUTH-UUID-HERE>',
  null,
  'admin@nexora-systems.com',
  'Nexora Super Admin',
  'super_admin',
  'super_admin',
  'active'
);
*/
-- 0007_storage.sql
-- Nexora Systems: Storage Bucket Provisioning (FR-CORE-10/12)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false, -- private, short-lived signed URLs only (FR-CORE-12)
  20971520, -- 20 MB max file size
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage bucket access policies
create policy "Authenticated users can read documents with signed URLs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "Authenticated users can upload documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');
-- 0008_arrears_job.sql
-- Nexora Systems: Automated Arrears Tracking & 90-Day Penalty Stop (FR-REPAY-03/04, Rules R-05, R-06)

create or replace function public.raise_arrears_events()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer := 0;
  v_rec record;
  v_days integer;
  v_penalty numeric(12,2);
  v_max_penalty numeric(12,2);
  v_handover boolean;
begin
  for v_rec in
    select
      s.id as schedule_id,
      s.tenant_id,
      s.loan_id,
      s.due_date,
      s.amount_due,
      l.application_id,
      coalesce(sum(r.amount_paid), 0) as paid_so_far
    from public.schedules s
    join public.loans l on s.loan_id = l.id
    left join public.repayments r on r.schedule_id = s.id
    where s.status in ('due', 'partial')
      and s.due_date < current_date
    group by s.id, s.tenant_id, s.loan_id, s.due_date, s.amount_due, l.application_id
  loop
    v_days := (current_date - v_rec.due_date);
    v_handover := (v_days >= 90); -- Rule R-06: 90-day stop

    -- Rule R-05: 30% penalty ceiling
    v_max_penalty := round((v_rec.amount_due - v_rec.paid_so_far) * 0.30, 2);

    -- Calculate default interest (capped at 90 days / 30% ceiling)
    if v_days > 90 then
      v_penalty := v_max_penalty;
    else
      v_penalty := round(((v_rec.amount_due - v_rec.paid_so_far) * 0.30) * (least(v_days, 90)::numeric / 90.0), 2);
    end if;

    -- Upsert arrears event
    insert into public.arrears_events (
      tenant_id, loan_id, schedule_id, days_past_due, penalty_charged, status, hand_over_required, updated_at
    ) values (
      v_rec.tenant_id, v_rec.loan_id, v_rec.schedule_id, v_days, v_penalty,
      case when v_handover then 'handed_over' else 'open' end,
      v_handover,
      now()
    )
    on conflict (id) do update set
      days_past_due = excluded.days_past_due,
      penalty_charged = excluded.penalty_charged,
      status = excluded.status,
      hand_over_required = excluded.hand_over_required,
      updated_at = now();

    -- Transition application and loan status
    update public.applications
    set status = case when v_handover then 'handed_over' else 'in_arrears' end,
        updated_at = now()
    where id = v_rec.application_id
      and status not in ('settled', 'handed_over');

    update public.loans
    set status = case when v_handover then 'handed_over' else 'in_arrears' end,
        updated_at = now()
    where id = v_rec.loan_id
      and status not in ('settled', 'handed_over');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- To run automatically every day at 01:00 AM, enable pg_cron in Supabase (Database -> Extensions)
-- and uncomment the line below:
-- select cron.schedule('daily-arrears-job', '0 1 * * *', 'select public.raise_arrears_events();');
