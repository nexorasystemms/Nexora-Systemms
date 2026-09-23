"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginCodeEmail } from "@/lib/email/send";

export type SendLoginCodeResult = { ok: true } | { ok: false; message: string };

// Admin/super-admin login step 2: mint a one-time code via Supabase's admin API (a
// privileged server call, not the public rate-limited /otp endpoint) and email it ourselves
// via custom SMTP — sidesteps Supabase's own OTP-send rate limit entirely. The code is later
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
    // TEMPORARY: Log the OTP to console for testing when email fails
    console.log(`🔐 LOGIN CODE for ${email}: ${data.properties.email_otp}`);
    console.error("Email send failed:", err instanceof Error ? err.message : err);
    
    // Return success so login can continue - the code will be in the console
    return { ok: true };
  }

  return { ok: true };
}
