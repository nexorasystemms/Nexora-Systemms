import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { loginCodeEmail, passwordResetEmail } from "./login-code-template";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not set — see .env.local.example.");

    // Gmail's own SMTP servers authenticate the send, so there's no sending-domain DNS
    // verification to do — this is what makes it work with no custom domain at all, unlike
    // Resend's shared address (see resend.ts). Requires a Google Account App Password, not
    // the account's normal login password (App Passwords need 2-Step Verification enabled:
    // Google Account -> Security -> 2-Step Verification -> App passwords).
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendViaGmail(to: string, code: string, type: "login" | "password_reset" = "login") {
  const emailTemplate = type === "password_reset" ? passwordResetEmail(code) : loginCodeEmail(code);
  const { subject, text, html } = emailTemplate;
  const from = process.env.GMAIL_USER!;
  await getTransporter().sendMail({ from: `Nexora Systems <${from}>`, to, subject, text, html });
}
