import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRow, ApplicantRow } from "@/types/database";

export type BorrowerContext = {
  user: UserRow;
  applicant: ApplicantRow | null;
};

/** Loads the signed-in borrower record (public.users), or redirects to /portal/login. */
export async function requireBorrower(): Promise<BorrowerContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal/login");

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) redirect("/portal/login?error=no_user_record");
  if (profile.status !== "active") redirect("/portal/login?error=inactive_account");
  if (profile.role !== "borrower") redirect("/?error=staff_account");

  let applicant: ApplicantRow | null = null;
  if (profile.applicant_id) {
    const { data: applicantData } = await supabase
      .from("applicants")
      .select("*")
      .eq("id", profile.applicant_id)
      .maybeSingle();
    applicant = applicantData;
  }

  return { user: profile, applicant };
}
