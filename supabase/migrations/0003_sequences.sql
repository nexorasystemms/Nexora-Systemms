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
