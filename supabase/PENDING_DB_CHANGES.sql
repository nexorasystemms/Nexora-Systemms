-- Paste this entire script into Supabase → SQL Editor → Run.
-- Uses text + CHECK constraints only. No PostgreSQL ENUM types.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Drop older function signatures (including any that used ENUMs)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_loan_application',
        'update_application_status',
        'record_staff_decision',
        'verify_email_code',
        'issue_email_verification_code'
      )
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 0020  Borrower self-register on Auth signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_full_name text;
  v_mobile text;
  v_id_type text;
  v_id_number text;
  v_id_hash text;
  v_id_token text;
  v_applicant_id uuid;
begin
  select id into v_tenant_id from public.tenants where slug = 'tmu-cashloan' limit 1;

  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  v_mobile := nullif(trim(coalesce(new.raw_user_meta_data->>'mobile', '')), '');
  v_id_type := coalesce(nullif(trim(new.raw_user_meta_data->>'id_type'), ''), 'personal_id');
  v_id_number := nullif(trim(coalesce(new.raw_user_meta_data->>'id_number', '')), '');

  if v_id_type not in ('personal_id', 'passport') then
    v_id_type := 'personal_id';
  end if;

  insert into public.users (
    id, tenant_id, email, full_name, phone, platform_role, role, status
  ) values (
    new.id,
    v_tenant_id,
    new.email,
    coalesce(v_full_name, split_part(new.email, '@', 1)),
    v_mobile,
    'tenant_user',
    'borrower',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.users.phone),
    status = 'active';

  if v_tenant_id is not null and v_id_number is not null then
    begin
      v_id_hash := public.hash_secure_value(v_id_number);
      select id into v_applicant_id
      from public.applicants
      where tenant_id = v_tenant_id and id_number_hash = v_id_hash
      limit 1;

      if v_applicant_id is null then
        v_id_token := public.tokenize_secure_value(v_tenant_id, 'id_number', v_id_number);
        v_applicant_id := gen_random_uuid();
        insert into public.applicants (
          id, tenant_id, full_name, id_type, id_number_token, id_number_hash,
          mobile, email, residential_address, marital_status, dependants_count,
          next_of_kin_name, next_of_kin_mobile, created_by
        ) values (
          v_applicant_id,
          v_tenant_id,
          coalesce(v_full_name, split_part(new.email, '@', 1)),
          v_id_type,
          coalesce(v_id_token, 'tok_pending'),
          coalesce(v_id_hash, encode(gen_random_bytes(16), 'hex')),
          coalesce(v_mobile, '0000000000'),
          new.email,
          'To be completed',
          'single',
          0,
          'To be completed',
          '0000000000',
          new.id
        );
      end if;

      update public.users
      set applicant_id = v_applicant_id
      where id = new.id;
    exception when others then
      raise notice 'borrower applicant create skipped: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 0021  Email verification codes (3 minutes)
-- ---------------------------------------------------------------------------
create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code text not null,
  type text not null default 'registration',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_verifications add column if not exists used_at timestamptz;

alter table public.email_verifications drop constraint if exists email_verifications_type_check;
alter table public.email_verifications
  add constraint email_verifications_type_check
  check (type in ('registration', 'login', 'password_reset', 'email_change'));

create index if not exists idx_email_verifications_lookup
  on public.email_verifications (user_id, code, type);

alter table public.email_verifications enable row level security;

create or replace function public.verify_email_code(p_user_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  v_code := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');

  if p_user_id is null or length(v_code) < 6 then
    return json_build_object('success', false, 'error', 'Invalid verification code');
  end if;

  select id into v_id
  from public.email_verifications
  where user_id = p_user_id
    and regexp_replace(code, '[^0-9]', '', 'g') = v_code
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_id is null then
    return json_build_object('success', false, 'error', 'Invalid or expired verification code');
  end if;

  update public.email_verifications
  set used_at = now()
  where id = v_id;

  update public.users
  set status = 'active', updated_at = now()
  where id = p_user_id;

  begin
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = p_user_id;
  exception when others then
    null;
  end;

  return json_build_object('success', true, 'message', 'Email verified successfully');
end;
$$;

create or replace function public.issue_email_verification_code(
  p_user_id uuid,
  p_email text,
  p_type text default 'registration'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_expires timestamptz;
begin
  if p_user_id is null or p_email is null then
    return json_build_object('success', false, 'error', 'Email and user are required');
  end if;

  v_code := lpad(floor(10000000 + random() * 90000000)::int::text, 8, '0');
  v_expires := now() + interval '3 minutes';

  insert into public.email_verifications (user_id, email, code, type, expires_at)
  values (p_user_id, p_email, v_code, coalesce(p_type, 'registration'), v_expires);

  return json_build_object('success', true, 'expiresAt', v_expires);
end;
$$;

revoke all on function public.verify_email_code(uuid, text) from public;
revoke all on function public.issue_email_verification_code(uuid, text, text) from public;
grant execute on function public.verify_email_code(uuid, text) to anon, authenticated;
grant execute on function public.issue_email_verification_code(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 0022  Loan product on applications
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists loan_product text;

alter table public.applications
  drop constraint if exists applications_loan_product_check;

update public.applications
set loan_product = case loan_product
  when 'payday_advance' then 'personal_no_payslip'
  when 'short_term_instalment' then 'first_time_credit_check'
  when 'payroll_scheme' then 'tender_purchase_order'
  else loan_product
end
where loan_product in ('payday_advance', 'short_term_instalment', 'payroll_scheme');

alter table public.applications
  add constraint applications_loan_product_check
  check (loan_product is null or loan_product in (
    'personal_no_payslip',
    'first_time_credit_check',
    'tender_purchase_order'
  ));

create or replace function public.create_loan_application(
  p_tenant_id uuid,
  p_applicant_id uuid,
  p_amount_requested numeric,
  p_term_months integer,
  p_product_type text,
  p_next_pay_date date default null,
  p_purpose_category text default null,
  p_purpose_text text default null,
  p_referral_source text default null,
  p_has_prior_credit text default null,
  p_created_by uuid default null,
  p_duplicate_override_reason text default null,
  p_loan_product text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_number text;
  live_apps_count integer;
  new_application_id uuid;
begin
  if p_product_type is not null and p_product_type not in ('once_off', 'instalment') then
    return json_build_object('success', false, 'status', 'error', 'message', 'Invalid product type');
  end if;
  if p_loan_product is not null and p_loan_product not in ('personal_no_payslip', 'first_time_credit_check', 'tender_purchase_order') then
    return json_build_object('success', false, 'status', 'error', 'message', 'Invalid loan product');
  end if;
  if p_has_prior_credit is not null and p_has_prior_credit not in ('no', 'had', 'have') then
    return json_build_object('success', false, 'status', 'error', 'message', 'Invalid prior credit value');
  end if;

  select count(*) into live_apps_count
  from public.applications
  where applicant_id = p_applicant_id
    and status not in ('settled', 'declined', 'withdrawn', 'handed_over');

  if live_apps_count > 0 and (p_duplicate_override_reason is null or p_duplicate_override_reason = '') then
    return json_build_object(
      'success', false,
      'status', 'error',
      'message', 'This applicant already has a live application (rule R-15). A compliance/admin user must supply an override reason to proceed.'
    );
  end if;

  select public.next_reference_number(p_tenant_id, 'application', 'APP-') into ref_number;
  if ref_number is null then
    ref_number := 'APP-' || extract(epoch from now())::text;
  end if;

  new_application_id := gen_random_uuid();

  insert into public.applications (
    id, tenant_id, applicant_id, reference_number, amount_requested, term_months,
    product_type, loan_product, next_pay_date, purpose_category, purpose_text,
    referral_source, has_prior_credit, status, created_by, created_at
  ) values (
    new_application_id, p_tenant_id, p_applicant_id, ref_number, p_amount_requested, p_term_months,
    coalesce(p_product_type, 'once_off'), nullif(p_loan_product, ''), p_next_pay_date,
    nullif(p_purpose_category, ''), nullif(p_purpose_text, ''), nullif(p_referral_source, ''),
    p_has_prior_credit, 'draft', p_created_by, now()
  );

  if live_apps_count > 0 and p_duplicate_override_reason is not null and p_duplicate_override_reason != '' then
    insert into public.application_overrides (
      tenant_id, application_id, override_type, reason_code, notes, overridden_by, created_at
    ) values (
      p_tenant_id, new_application_id, 'duplicate_application', 'R-15-OVERRIDE',
      p_duplicate_override_reason, p_created_by, now()
    );
  end if;

  return json_build_object(
    'success', true,
    'status', 'success',
    'applicationId', new_application_id,
    'referenceNumber', ref_number,
    'message', 'Application created successfully'
  );
exception when others then
  return json_build_object(
    'success', false,
    'status', 'error',
    'message', 'Failed to create application: ' || sqlerrm
  );
end;
$$;

grant execute on function public.create_loan_application(
  uuid, uuid, numeric, integer, text, date, text, text, text, text, uuid, text, text
) to authenticated;

create or replace function public.update_application_status(
  p_application_id uuid,
  p_status text,
  p_updated_by uuid
) returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in (
    'draft', 'submitted', 'under_review', 'awaiting_documents', 'assessed',
    'approved', 'approved_with_changes', 'declined', 'withdrawn',
    'agreement_generated', 'agreement_accepted', 'disbursed', 'performing',
    'in_arrears', 'settled', 'handed_over'
  ) then
    return json_build_object('success', false, 'message', 'Invalid application status');
  end if;

  update public.applications
  set status = p_status, updated_at = now()
  where id = p_application_id;

  if not found then
    return json_build_object('success', false, 'message', 'Application not found');
  end if;

  return json_build_object('success', true, 'message', 'Application status updated successfully');
exception when others then
  return json_build_object('success', false, 'message', 'Failed to update application status: ' || sqlerrm);
end;
$$;

grant execute on function public.update_application_status(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 0023  Documents filename + staff decisions (no AI required)
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists original_filename text;

alter table public.decisions
  alter column assessment_id drop not null;

create or replace function public.record_staff_decision(
  p_application_id uuid,
  p_outcome text,
  p_reason_code text,
  p_notes text default null,
  p_amount_approved numeric default null,
  p_term_approved integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_user public.users%rowtype;
  v_status text;
begin
  if p_outcome not in ('approved', 'approved_with_changes', 'declined') then
    return json_build_object('success', false, 'error', 'Invalid outcome');
  end if;
  if p_reason_code is null or length(trim(p_reason_code)) = 0 then
    return json_build_object('success', false, 'error', 'A reason is required');
  end if;

  select * into v_user from public.users where id = auth.uid();
  if v_user.id is null or v_user.role = 'borrower' then
    return json_build_object('success', false, 'error', 'Not authorised');
  end if;

  select * into v_app from public.applications where id = p_application_id;
  if v_app.id is null then
    return json_build_object('success', false, 'error', 'Application not found');
  end if;

  insert into public.decisions (
    tenant_id, application_id, assessment_id, outcome, amount_approved, term_approved,
    reason_code, notes, decided_by
  ) values (
    v_app.tenant_id, p_application_id, null, p_outcome, p_amount_approved, p_term_approved,
    trim(p_reason_code), nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  );

  v_status := case p_outcome
    when 'declined' then 'declined'
    when 'approved_with_changes' then 'approved_with_changes'
    else 'approved'
  end;

  update public.applications
  set status = v_status, updated_at = now()
  where id = p_application_id;

  return json_build_object('success', true, 'status', v_status);
end;
$$;

grant execute on function public.record_staff_decision(uuid, text, text, text, numeric, integer) to authenticated;

drop policy if exists "Borrower insert employment" on public.employment;
create policy "Borrower insert employment" on public.employment
  for insert with check (
    application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
  );

drop policy if exists "Borrower insert consents" on public.consents;
create policy "Borrower insert consents" on public.consents
  for insert with check (
    applicant_id = public.current_applicant_id()
  );

alter table public.consents
  drop constraint if exists consents_consent_type_check;

alter table public.consents
  add constraint consents_consent_type_check
  check (consent_type in (
    'credit_assessment',
    'bureau_enquiry_and_submission',
    'debt_collection_disclosure',
    'marketing',
    'cession_disclosure',
    'eft_mandate'
  ));

drop policy if exists "Borrower insert income_expenditure" on public.income_expenditure;
create policy "Borrower insert income_expenditure" on public.income_expenditure
  for insert with check (
    application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
  );

drop policy if exists "Borrower insert credit_history" on public.credit_history;
create policy "Borrower insert credit_history" on public.credit_history
  for insert with check (
    application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
  );

drop policy if exists "Borrower insert bank_details" on public.bank_details;
create policy "Borrower insert bank_details" on public.bank_details
  for insert with check (
    application_id in (select id from public.applications where applicant_id = public.current_applicant_id())
  );
