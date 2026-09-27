/**
 * Client apps must not send mail. SMTP lives in supabase/functions/send-email
 * and is configured with non-VITE_ secrets on the Supabase project.
 */
export async function sendLoginCodeEmail(_to: string, _code: string): Promise<void> {
  throw new Error("Email is sent by the send-email Edge Function, not the browser bundle.");
}

export async function sendPasswordResetEmail(_to: string, _code: string): Promise<void> {
  throw new Error("Email is sent by the send-email Edge Function, not the browser bundle.");
}
