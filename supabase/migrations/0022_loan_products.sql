alter table public.applications
  add column if not exists loan_product text;

alter table public.applications
  drop constraint if exists applications_loan_product_check;

alter table public.applications
  add constraint applications_loan_product_check
  check (loan_product is null or loan_product in (
    'personal_no_payslip',
    'first_time_credit_check',
    'tender_purchase_order'
  ));

create or replace function create_loan_application(
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
  select count(*) into live_apps_count
  from applications
  where applicant_id = p_applicant_id
    and status not in ('settled', 'declined', 'withdrawn', 'handed_over');

  if live_apps_count > 0 and (p_duplicate_override_reason is null or p_duplicate_override_reason = '') then
    return json_build_object(
      'success', false,
      'status', 'error',
      'message', 'This applicant already has a live application (rule R-15). A compliance/admin user must supply an override reason to proceed.'
    );
  end if;

  select next_reference_number(p_tenant_id, 'application', 'APP-') into ref_number;
  if ref_number is null then
    ref_number := 'APP-' || extract(epoch from now())::text;
  end if;

  new_application_id := gen_random_uuid();

  insert into applications (
    id, tenant_id, applicant_id, reference_number, amount_requested, term_months,
    product_type, loan_product, next_pay_date, purpose_category, purpose_text,
    referral_source, has_prior_credit, status, created_by, created_at
  ) values (
    new_application_id, p_tenant_id, p_applicant_id, ref_number, p_amount_requested, p_term_months,
    p_product_type, nullif(p_loan_product, ''), p_next_pay_date, nullif(p_purpose_category, ''),
    nullif(p_purpose_text, ''), nullif(p_referral_source, ''), p_has_prior_credit, 'draft',
    p_created_by, now()
  );

  if live_apps_count > 0 and p_duplicate_override_reason is not null and p_duplicate_override_reason != '' then
    insert into application_overrides (
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

grant execute on function create_loan_application(
  uuid, uuid, numeric, integer, text, date, text, text, text, text, uuid, text, text
) to authenticated;
