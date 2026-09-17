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
