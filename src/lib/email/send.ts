import "server-only";

// Picks whichever email transport is actually configured, in order of preference:
//   1. Custom SMTP (custom-smtp.ts) — a verified sending domain (Zoho, etc.). The most
//      durable option once one exists: not tied to a personal Gmail account or limited to
//      Resend's single-recipient shared test address.
//   2. Gmail SMTP (gmail.ts) — needs no domain at all and can deliver to any address, so it's
//      the right fallback while there's no verified domain yet.
//   3. Resend (resend.ts) — free-tier fallback; its shared onboarding@resend.dev address can
//      only deliver to the email on the Resend account itself.
// No code changes are needed to switch which one is active — just the env vars.
export async function sendLoginCodeEmail(to: string, code: string): Promise<void> {
  if (process.env.CUSTOM_SMTP_HOST && process.env.CUSTOM_SMTP_USER && process.env.CUSTOM_SMTP_PASSWORD) {
    const { sendViaCustomSmtp } = await import("./custom-smtp");
    return sendViaCustomSmtp(to, code, "login");
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const { sendViaGmail } = await import("./gmail");
    return sendViaGmail(to, code, "login");
  }

  if (process.env.RESEND_API_KEY) {
    const { sendViaResend } = await import("./resend");
    return sendViaResend(to, code, "login");
  }

  throw new Error(
    "No email provider configured — set CUSTOM_SMTP_HOST/USER/PASSWORD, GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY, in .env.local.",
  );
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  if (process.env.CUSTOM_SMTP_HOST && process.env.CUSTOM_SMTP_USER && process.env.CUSTOM_SMTP_PASSWORD) {
    const { sendViaCustomSmtp } = await import("./custom-smtp");
    return sendViaCustomSmtp(to, code, "password_reset");
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const { sendViaGmail } = await import("./gmail");
    return sendViaGmail(to, code, "password_reset");
  }

  if (process.env.RESEND_API_KEY) {
    const { sendViaResend } = await import("./resend");
    return sendViaResend(to, code, "password_reset");
  }

  throw new Error(
    "No email provider configured — set CUSTOM_SMTP_HOST/USER/PASSWORD, GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY, in .env.local.",
  );
}
