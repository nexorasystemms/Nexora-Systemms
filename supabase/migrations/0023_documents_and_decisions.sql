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
