-- Allow borrowers to self-register without the verify-email Edge Function.
-- Creates a public.users row (and a draft applicant when possible) when Auth signs up.

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
  for each row execute procedure public.handle_new_auth_user();
