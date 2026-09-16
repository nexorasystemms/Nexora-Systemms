import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ApplicantRow } from "@/types/database";

/** Loads the signed-in borrower's own applicant record (public.applicants, via auth_user_id),
 *  or redirects to /portal/login. Every portal page should call this first — RLS (see
 *  supabase/migrations/0009_portal_applicant_accounts.sql) is what actually enforces that a
 *  borrower only ever sees their own row; this just gets that row or bounces them out.
 *
 *  No account tier ("Should complete registration") exists yet: registration always creates
 *  the applicants row in the same step as the auth user, so a signed-in user with no matching
 *  row here is either mid-registration or a staff account that wandered into /portal — either
 *  way, registration is the safe place to send them. */
export async function requireBorrower(): Promise<ApplicantRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const { data: applicant, error } = await supabase
    .from("applicants")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !applicant) redirect("/portal/register");

  return applicant;
}
