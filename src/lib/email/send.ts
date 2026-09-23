import nodemailer from "nodemailer";

// Email sending for admin/super-admin login codes and system notifications.
// Uses Gmail SMTP if configured, otherwise falls back to custom SMTP (Namecheap/Zoho).

export async function sendLoginCodeEmail(to: string, code: string): Promise<void> {
  // Try Gmail first if configured
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      await sendViaGmail(to, code);
      return;
    } catch (err) {
      console.error("Gmail send failed, falling back to custom SMTP:", err);
    }
  }

  // Fall back to custom SMTP
  if (!process.env.CUSTOM_SMTP_HOST || !process.env.CUSTOM_SMTP_USER || !process.env.CUSTOM_SMTP_PASSWORD) {
    throw new Error("No email provider configured (GMAIL or CUSTOM_SMTP)");
  }

  await sendViaCustomSMTP(to, code);
}

async function sendViaGmail(to: string, code: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: "Your Nexora sign-in code",
    text: `Your sign-in code is: ${code}\n\nThis code expires shortly. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your sign-in code</h2>
        <p>Your sign-in code is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 0.5em;">${code}</span>
        </div>
        <p style="color: #666;">This code expires shortly. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

async function sendViaCustomSMTP(to: string, code: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.CUSTOM_SMTP_HOST,
    port: parseInt(process.env.CUSTOM_SMTP_PORT || "587"),
    secure: process.env.CUSTOM_SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.CUSTOM_SMTP_USER,
      pass: process.env.CUSTOM_SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.CUSTOM_SMTP_FROM ?? `Nexora Systems <${process.env.CUSTOM_SMTP_USER}>`,
    to,
    subject: "Your Nexora sign-in code",
    text: `Your sign-in code is: ${code}\n\nThis code expires shortly. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #241c5b;">Your sign-in code</h2>
        <p>Your sign-in code is:</p>
        <div style="background: #f6f7fb; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; border: 1px solid #e3e5ef;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #241c5b;">${code}</span>
        </div>
        <p style="color: #666;">This code expires shortly. If you didn't request this, ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e3e5ef; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">
          Nexora Intelligent Operations Platform — Cash Loan Module<br />
          TMU CashLoan CC pilot
        </p>
      </div>
    `,
  });
}
