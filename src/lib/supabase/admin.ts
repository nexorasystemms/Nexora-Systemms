import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Service-role client. Bypasses RLS entirely — use ONLY in trusted server code for actions
 *  that genuinely need to cross tenant/role boundaries (e.g. creating a new staff auth user
 *  from the admin console). Never import this into client components or expose the key. */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
