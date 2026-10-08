-- Email verification without the verify-email Edge Function.
-- The browser cannot reach that function ("Failed to send a request to the Edge Function").

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

  -- Do not return the code to the browser.
  return json_build_object('success', true, 'expiresAt', v_expires);
end;
$$;

revoke all on function public.verify_email_code(uuid, text) from public;
revoke all on function public.issue_email_verification_code(uuid, text, text) from public;
grant execute on function public.verify_email_code(uuid, text) to anon, authenticated;
grant execute on function public.issue_email_verification_code(uuid, text, text) to anon, authenticated;
