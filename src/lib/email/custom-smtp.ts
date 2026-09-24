import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { loginCodeEmail, passwordResetEmail } from "./login-code-template";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const host = process.env.CUSTOM_SMTP_HOST;
    const user = process.env.CUSTOM_SMTP_USER;
    const pass = process.env.CUSTOM_SMTP_PASSWORD;
    if (!host || !user || !pass) {
      throw new Error("CUSTOM_SMTP_HOST / CUSTOM_SMTP_USER / CUSTOM_SMTP_PASSWORD are not set — see .env.local.example.");
    }

    const port = Number(process.env.CUSTOM_SMTP_PORT || "587");

    // A verified sending domain (e.g. Zoho Mail on your own domain) — the most durable option
    // once one exists, since it isn't tied to a personal Gmail account or Resend's shared,
    // single-recipient test address.
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587/others use STARTTLS
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendViaCustomSmtp(to: string, code: string, type: "login" | "password_reset" = "login") {
  const emailTemplate = type === "password_reset" ? passwordResetEmail(code) : loginCodeEmail(code);
  const { subject, text, html } = emailTemplate;
  const from = process.env.CUSTOM_SMTP_FROM || `Nexora Systems <${process.env.CUSTOM_SMTP_USER}>`;
  await getTransporter().sendMail({ from, to, subject, text, html });
}
