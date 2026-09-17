import "server-only";

// Picks whichever email transport is actually configured. Gmail SMTP is tried first because
// it needs no domain of any kind (Nexora doesn't have one yet) and can deliver to any
// address; Resend is the fallback for once a domain is verified there (see resend.ts) — no
// code changes will be needed to switch, just the env vars.
export async function sendLoginCodeEmail(to: string, code: string): Promise<void> {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const { sendViaGmail } = await import("./gmail");
    return sendViaGmail(to, code);
  }

  if (process.env.RESEND_API_KEY) {
    const { sendViaResend } = await import("./resend");
    return sendViaResend(to, code);
  }

  throw new Error(
    "No email provider configured — set either GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY, in .env.local.",
  );
}
