import { env } from "../config/env.js";

// Minimal PostgREST / Auth / Storage client (fetch only) for the TMU Supabase project.
// The service-role key bypasses RLS, so callers must authorise requests themselves (see authenticate()).

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  }
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!env.supabaseUrl || !env.supabaseServiceKey) throw new SupabaseNotConfiguredError();
  return {
    apikey: env.supabaseServiceKey,
    authorization: `Bearer ${env.supabaseServiceKey}`,
    "content-type": "application/json",
    ...extra,
  };
}

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);

/** GET rows. `query` is a PostgREST query string, e.g. "application_id=eq.123&select=*". */
export async function selectRows<T = any>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${table}?${query}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`Supabase select ${table} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

export async function insertRow<T = any>(table: string, row: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: serviceHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as T[])[0] as T;
}

export async function updateRows(table: string, query: string, patch: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} failed: ${res.status} ${await res.text()}`);
}

export async function downloadStorageObject(bucket: string, path: string): Promise<Uint8Array> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${bucket}/${encoded}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error(`Storage download failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export interface Caller {
  id: string;
  role: string;
  tenantId: string | null;
  applicantId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Validates the caller's Supabase session token and loads their profile.
 * Returns null when the token is missing/invalid.
 */
export async function authenticate(authorizationHeader: string | undefined): Promise<Caller | null> {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7) : undefined;
  if (!token || !env.supabaseUrl || !env.supabaseAnonKey) return null;

  const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.supabaseAnonKey, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;

  const [profile] = await selectRows<any>(
    "users",
    `id=eq.${user.id}&select=id,role,tenant_id,applicant_id,platform_role,status`,
  );
  if (!profile || profile.status !== "active") return null;

  return {
    id: profile.id,
    role: profile.role,
    tenantId: profile.tenant_id ?? null,
    applicantId: profile.applicant_id ?? null,
    isSuperAdmin: profile.role === "super_admin" || profile.platform_role === "super_admin",
  };
}
