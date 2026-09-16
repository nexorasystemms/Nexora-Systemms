-- 0009_portal_applicant_accounts.sql
--
-- Adds a self-service borrower portal on top of the existing staff-console schema
-- (migrations 0001-0008, not present in this checkout — this migration is additive
-- and assumes that schema, RLS-enabled with tenant/role helpers, already exists).
--
-- A "borrower" is a Supabase Auth user linked 1:1 to an `applicants` row via the new
-- `auth_user_id` column. Everything a borrower can read or write is scoped, through RLS,
-- to rows they own via that link — never through the tenant/role model staff use, and
-- never through the service-role key. Run this once, after 0001-0008, on the pilot's
-- existing Supabase project.

-- ---------------------------------------------------------------------------
-- 1. Link applicants to their own Supabase Auth account
-- ---------------------------------------------------------------------------

alter table public.applicants
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists applicants_auth_user_id_idx on public.applicants(auth_user_id);

-- ---------------------------------------------------------------------------
-- 2. Helper functions the portal's anon/authenticated sessions may call directly.
--    Both are SECURITY DEFINER so the portal doesn't need broad table-level SELECT
--    grants on `tenants` or the full `policy_params` table.
-- ---------------------------------------------------------------------------

-- The pilot is single-tenant (TMU CashLoan CC): registration resolves the tenant
-- automatically as the oldest active one, rather than asking a borrower to pick.
create or replace function public.portal_default_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants where status = 'active' order by created_at asc limit 1;
$$;

grant execute on function public.portal_default_tenant_id() to anon, authenticated;

-- Only the disclosure-relevant figures (finance-charge cap, prime rate, ceilings) —
-- not the full policy_params table, which also holds internal affordability thresholds
-- (min living allowance, DSR ceiling, etc.) staff don't want borrower-visible.
-- "Latest by key" mirrors the same ordering the staff Policy Parameters screen uses
-- (src/app/(dashboard)/policy-params/page.tsx): most recent effective_from wins.
create or replace function public.portal_disclosure_params(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(latest.param_key, latest.param_value), '{}'::jsonb)
  from (
    select distinct on (param_key) param_key, param_value
    from public.policy_params
    where tenant_id = p_tenant_id
      and param_key in (
        'loan_ceiling_nad', 'term_ceiling_months',
        'finance_charge_cap_short_term_months', 'finance_charge_cap_short_pct',
        'finance_charge_cap_long_prime_multiplier', 'prime_rate_pct'
      )
    order by param_key, effective_from desc
  ) latest;
$$;

grant execute on function public.portal_disclosure_params(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS policies — a borrower may only touch rows their own `auth_user_id` owns,
--    transitively through applicant_id / application_id. No borrower policy ever
--    grants UPDATE or DELETE: a submitted application is corrected by staff, not
--    self-edited, matching how the staff console itself treats submitted records.
-- ---------------------------------------------------------------------------

drop policy if exists portal_applicants_select_own on public.applicants;
create policy portal_applicants_select_own on public.applicants
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists portal_applicants_insert_own on public.applicants;
create policy portal_applicants_insert_own on public.applicants
  for insert to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists portal_applications_select_own on public.applications;
create policy portal_applications_select_own on public.applications
  for select to authenticated
  using (applicant_id in (select id from public.applicants where auth_user_id = auth.uid()));

drop policy if exists portal_applications_insert_own on public.applications;
create policy portal_applications_insert_own on public.applications
  for insert to authenticated
  with check (applicant_id in (select id from public.applicants where auth_user_id = auth.uid()));

drop policy if exists portal_applications_update_own_draft on public.applications;
create policy portal_applications_update_own_draft on public.applications
  for update to authenticated
  using (
    status = 'draft'
    and applicant_id in (select id from public.applicants where auth_user_id = auth.uid())
  )
  with check (applicant_id in (select id from public.applicants where auth_user_id = auth.uid()));

drop policy if exists portal_employment_select_own on public.employment;
create policy portal_employment_select_own on public.employment
  for select to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_employment_insert_own on public.employment;
create policy portal_employment_insert_own on public.employment
  for insert to authenticated
  with check (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_employment_update_own on public.employment;
create policy portal_employment_update_own on public.employment
  for update to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid() and a.status = 'draft'
    )
  )
  with check (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_income_expenditure_select_own on public.income_expenditure;
create policy portal_income_expenditure_select_own on public.income_expenditure
  for select to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_income_expenditure_insert_own on public.income_expenditure;
create policy portal_income_expenditure_insert_own on public.income_expenditure
  for insert to authenticated
  with check (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_income_expenditure_update_own on public.income_expenditure;
create policy portal_income_expenditure_update_own on public.income_expenditure
  for update to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid() and a.status = 'draft'
    )
  )
  with check (
    application_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_documents_select_own on public.documents;
create policy portal_documents_select_own on public.documents
  for select to authenticated
  using (
    entity_type = 'application'
    and entity_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_documents_insert_own on public.documents;
create policy portal_documents_insert_own on public.documents
  for insert to authenticated
  with check (
    entity_type = 'application'
    and entity_id in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_consents_select_own on public.consents;
create policy portal_consents_select_own on public.consents
  for select to authenticated
  using (applicant_id in (select id from public.applicants where auth_user_id = auth.uid()));

drop policy if exists portal_consents_insert_own on public.consents;
create policy portal_consents_insert_own on public.consents
  for insert to authenticated
  with check (applicant_id in (select id from public.applicants where auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Storage — borrowers upload into the same `documents` bucket and path shape staff
--    use (`{tenant_id}/application/{application_id}/{doc_type}-{ts}.{ext}`), scoped to
--    applications they own.
-- ---------------------------------------------------------------------------

drop policy if exists portal_storage_upload_own_documents on storage.objects;
create policy portal_storage_upload_own_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'application'
    and (storage.foldername(name))[3]::uuid in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );

drop policy if exists portal_storage_read_own_documents on storage.objects;
create policy portal_storage_read_own_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'application'
    and (storage.foldername(name))[3]::uuid in (
      select a.id from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where ap.auth_user_id = auth.uid()
    )
  );
