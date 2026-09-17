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
