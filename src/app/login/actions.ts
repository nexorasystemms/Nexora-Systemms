"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginCodeEmail, sendPasswordResetEmail } from "@/lib/email/send";

export type SendLoginCodeResult = { ok: true } | { ok: false; message: string };
export type PasswordResetResult = { ok: true } | { ok: false; message: string };

// Admin/super-admin login step 2: mint a one-time code via Supabase's admin API (a
// privileged server call, not the public rate-limited /otp endpoint) and email it ourselves
// via Resend — sidesteps Supabase's own OTP-send rate limit entirely. The code is later
// verified through the normal, unauthenticated supabase.auth.verifyOtp() client call, which
// is what actually establishes the session, so Supabase still owns session issuance.
export async function sendAdminLoginCode(email: string): Promise<SendLoginCodeResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data?.properties?.email_otp) {
    return { ok: false, message: error?.message ?? "Could not generate a sign-in code." };
  }

  try {
    await sendLoginCodeEmail(email, data.properties.email_otp);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send the code email." };
  }

  return { ok: true };
}

// Password reset for admin users
export async function sendAdminPasswordReset(email: string): Promise<PasswordResetResult> {
  const admin = createAdminClient();

  // First, verify this is a valid admin user
  const { data: userProfile, error: profileError } = await admin
    .from("users")
    .select("id, role, status")
    .eq("email", email.trim().toLowerCase())
    .in("role", ["super_admin", "admin", "intake", "officer", "approver", "finance"])
    .maybeSingle();

  if (profileError || !userProfile) {
    return { ok: false, message: "No admin account found with this email address." };
  }

  if (userProfile.status !== "active") {
    return { ok: false, message: "This account is inactive. Please contact system administrator." };
  }

  // Generate password reset link with OTP
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
  });

  if (error || !data?.properties?.email_otp) {
    return { ok: false, message: error?.message ?? "Could not generate password reset code." };
  }

  try {
    await sendPasswordResetEmail(email.trim().toLowerCase(), data.properties.email_otp);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send the reset email." };
  }

  return { ok: true };
}
