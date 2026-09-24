export function loginCodeEmail(code: string) {
  return {
    subject: `${code} is your Nexora sign-in code`,
    text: `Your Nexora Systems sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 420px; margin: 0 auto;">
        <p style="color:#241c5b; font-weight:600; font-size:16px;">Nexora Systems</p>
        <p style="color:#171a2b; font-size:14px;">Your sign-in code is:</p>
        <p style="font-size:32px; font-weight:700; letter-spacing:0.3em; color:#241c5b; margin:16px 0;">${code}</p>
        <p style="color:#6b7089; font-size:12px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  };
}

export function passwordResetEmail(code: string) {
  return {
    subject: `${code} is your Nexora password reset code`,
    text: `Your Nexora Systems password reset code is ${code}. It expires in 10 minutes. Use this code to reset your password. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 420px; margin: 0 auto;">
        <p style="color:#241c5b; font-weight:600; font-size:16px;">Nexora Systems</p>
        <p style="color:#171a2b; font-size:14px;">Your password reset code is:</p>
        <p style="font-size:32px; font-weight:700; letter-spacing:0.3em; color:#241c5b; margin:16px 0;">${code}</p>
        <p style="color:#6b7089; font-size:12px;">This code expires in 10 minutes. Use it to reset your password. If you didn't request this, you can ignore this email.</p>
        <p style="color:#6b7089; font-size:12px; margin-top:20px;">For security reasons, never share this code with anyone.</p>
      </div>
    `,
  };
}
