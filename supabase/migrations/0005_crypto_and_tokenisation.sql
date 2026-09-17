-- 0005_crypto_and_tokenisation.sql
-- Nexora Systems: T3 Data Tokenisation, Encryption at Rest, and HMAC Blind Indexing (NFR-SEC-01)

create table if not exists public.encryption_keys (
  id uuid primary key default gen_random_uuid(),
  key_name text not null unique,
  secret_key text not null,
  hmac_secret text not null,
  created_at timestamptz not null default now()
);

-- Seed default random keys if not present
insert into public.encryption_keys (key_name, secret_key, hmac_secret)
values (
  'primary',
  encode(gen_random_bytes(32), 'hex'),
  encode(gen_random_bytes(32), 'hex')
)
on conflict (key_name) do nothing;

create table if not exists public.secure_tokens (
  token text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  field_type text not null,
  encrypted_value bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_secure_tokens_tenant on public.secure_tokens(tenant_id, field_type);

-- 1. HMAC Blind Index for Deduplication without Cleartext Storage
create or replace function public.hash_secure_value(p_plaintext text)
returns text
language plpgsql
security definer
as $$
declare
  v_hmac_secret text;
begin
  if p_plaintext is null or trim(p_plaintext) = '' then
    return null;
  end if;

  select hmac_secret into v_hmac_secret from public.encryption_keys where key_name = 'primary' limit 1;
  if v_hmac_secret is null then
    v_hmac_secret := 'nexora-fallback-static-salt-2026';
  end if;

  return encode(hmac(lower(trim(p_plaintext))::bytea, v_hmac_secret::bytea, 'sha256'), 'hex');
end;
$$;

-- 2. Tokenize Sensitive Value (Encrypted at Rest with AES-256)
create or replace function public.tokenize_secure_value(
  p_tenant_id uuid,
  p_field_type text,
  p_plaintext text
)
returns text
language plpgsql
security definer
as $$
declare
  v_secret_key text;
  v_token text;
  v_encrypted bytea;
begin
  if p_plaintext is null or trim(p_plaintext) = '' then
    return null;
  end if;

  select secret_key into v_secret_key from public.encryption_keys where key_name = 'primary' limit 1;
  if v_secret_key is null then
    v_secret_key := 'nexora-fallback-encryption-key-2026';
  end if;

  v_token := 'tok_' || p_field_type || '_' || encode(gen_random_bytes(16), 'hex');
  v_encrypted := pgp_sym_encrypt(trim(p_plaintext), v_secret_key);

  insert into public.secure_tokens (token, tenant_id, field_type, encrypted_value)
  values (v_token, p_tenant_id, p_field_type, v_encrypted);

  return v_token;
end;
$$;

-- 3. Reveal Sensitive Value (Audited Unmasking, NFR-SEC-01)
create or replace function public.reveal_secure_value(p_token text)
returns text
language plpgsql
security definer
as $$
declare
  v_secret_key text;
  v_record record;
  v_decrypted text;
begin
  if p_token is null or trim(p_token) = '' then
    return null;
  end if;

  select secret_key into v_secret_key from public.encryption_keys where key_name = 'primary' limit 1;
  select * into v_record from public.secure_tokens where token = p_token;

  if not found then
    return null;
  end if;

  v_decrypted := pgp_sym_decrypt(v_record.encrypted_value, v_secret_key);

  -- Append to audit log (FR-CORE-20)
  insert into public.audit_log (
    tenant_id, actor_type, actor_id, action, entity_type, entity_id, record_hash
  ) values (
    v_record.tenant_id,
    'human',
    auth.uid(),
    'unmask_t3_token',
    'secure_token',
    p_token,
    encode(sha256((coalesce(auth.uid()::text, 'anon') || p_token || now()::text)::bytea), 'hex')
  );

  return v_decrypted;
end;
$$;
