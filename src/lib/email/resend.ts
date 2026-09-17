import "server-only";
import { Resend } from "resend";
import { loginCodeEmail } from "./login-code-template";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set — see .env.local.example.");
    client = new Resend(apiKey);
  }
  return client;
}

// resend.dev is Resend's shared testing domain — it works immediately with no DNS setup, but
// (important) can only deliver TO the email address on your own Resend account, not to
// arbitrary staff. Verify your own domain (Resend dashboard -> Domains) and set
// RESEND_FROM_EMAIL before this can email codes to any admin other than that one account.
const FROM = process.env.RESEND_FROM_EMAIL || "Nexora Systems <onboarding@resend.dev>";

export async function sendViaResend(to: string, code: string) {
  const { subject, text, html } = loginCodeEmail(code);
  const { error } = await getClient().emails.send({ from: FROM, to, subject, text, html });
  if (error) throw new Error(error.message);
}
