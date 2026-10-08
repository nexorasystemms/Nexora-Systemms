-- Three TMU loan types as text (no PostgreSQL ENUM types).
-- 1. personal_no_payslip — personal loan, no payslip, once-off EFT
-- 2. first_time_credit_check — new clients, credit background check required
-- 3. tender_purchase_order — tender finance, purchase order required

update public.applications
set loan_product = case loan_product
  when 'payday_advance' then 'personal_no_payslip'
  when 'short_term_instalment' then 'first_time_credit_check'
  when 'payroll_scheme' then 'tender_purchase_order'
  else loan_product
end
where loan_product in ('payday_advance', 'short_term_instalment', 'payroll_scheme');

alter table public.applications
  drop constraint if exists applications_loan_product_check;

alter table public.applications
  add constraint applications_loan_product_check
  check (loan_product is null or loan_product in (
    'personal_no_payslip',
    'first_time_credit_check',
    'tender_purchase_order'
  ));

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
  if p_loan_product is not null and p_loan_product not in (
    'personal_no_payslip', 'first_time_credit_check', 'tender_purchase_order'
  ) then
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
      'success', false, 'status', 'error',
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
    'success', true, 'status', 'success',
    'applicationId', new_application_id, 'referenceNumber', ref_number,
    'message', 'Application created successfully'
  );
exception when others then
  return json_build_object('success', false, 'status', 'error', 'message', 'Failed to create application: ' || sqlerrm);
end;
$$;

grant execute on function public.create_loan_application(
  uuid, uuid, numeric, integer, text, date, text, text, text, text, uuid, text, text
) to authenticated;

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
