import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginAdmin, verifyAdminLogin, resendAdminLoginCode, sendPasswordResetCode, verifyPasswordResetCode, completePasswordReset } from "@/lib/supabase/auth";
import { usePageTitle } from "@/lib/usePageTitle";

type Stage = "password" | "email_otp" | "forgot_password" | "reset_code" | "reset_password";

const CODE_TTL_SECONDS = 180;

function formatMmSs(total: number): string {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  usePageTitle("Staff Sign In");

  const [stage, setStage] = useState<Stage>("password");
  const [tempUserId, setTempUserId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => {
    const message = searchParams.get("message");
    if (message === "password-updated") return "Password updated. Sign in with your new password and current email.";
    if (message === "email-changed") return "Email updated. Sign in with your new email address.";
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [codeExpiresIn, setCodeExpiresIn] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCodeExpiresIn((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginAdmin(email.trim().toLowerCase(), password);
    if (!result.success) {
      setError(result.error || "Login failed");
      setLoading(false);
      return;
    }
    if (result.requiresVerification && result.tempUserId) {
      setTempUserId(result.tempUserId);
      setStage("email_otp");
      setCodeExpiresIn(CODE_TTL_SECONDS);
      setLoading(false);
      return;
    }
    navigate(next);
  }

  async function handleEmailOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await verifyAdminLogin(tempUserId, code, email.trim().toLowerCase(), password);
    if (!result.success) {
      setError(result.error || "Invalid verification code");
      setLoading(false);
      return;
    }
    navigate(next);
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await sendPasswordResetCode(email);
    if (!result.success) {
      setError(result.error || "Failed to send reset code");
      setLoading(false);
      return;
    }
    setStage("reset_code");
    setCode("");
    setLoading(false);
    setCodeExpiresIn(CODE_TTL_SECONDS);
  }

  async function handleResetCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await verifyPasswordResetCode(email, code);
    if (!result.success) {
      setError(result.error || "Invalid or expired verification code");
      setLoading(false);
      return;
    }
    setStage("reset_password");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  async function handleSaveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const result = await completePasswordReset(newPassword);
    if (!result.success) {
      setError(result.error || "Failed to reset password");
      setLoading(false);
      return;
    }
    setStage("password");
    setPassword(""); setNewPassword(""); setConfirmPassword(""); setCode("");
    setInfo("Password updated. Sign in with your new password and current email.");
    setLoading(false);
  }

  async function handleResend() {
    if (codeExpiresIn > 0) return;
    setError(null);
    const result = stage === "email_otp"
      ? await resendAdminLoginCode(email, tempUserId)
      : await sendPasswordResetCode(email);
    if (result.success) setCodeExpiresIn(CODE_TTL_SECONDS);
    else setError(result.error || "Failed to resend code");
  }

  return (
    <div data-surface="admin" className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-tertiary-fixed/15 blur-2xl pointer-events-none" />

          <div className="relative p-margin-desktop flex flex-col gap-space-lg">
            {/* Branding */}
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-sm">
                <img src="/brand/nexora-mark.png" alt="Nexora Systems" width={32} height={32} className="shrink-0" />
                <div className="flex flex-col">
                  <span className="text-lg font-bold tracking-tight text-on-surface">Nexora Systems</span>
                  <span className="text-[10px] uppercase text-secondary font-semibold">Cash Loan Origination Console</span>
                </div>
              </div>
              <div className="mt-space-xs rounded bg-surface-container-low px-space-md py-space-sm">
                <div className="flex items-center gap-space-xs text-primary">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  <span className="text-[12px] font-medium text-on-surface">TMU CashLoan CC</span>
                </div>
                <p className="text-[11px] text-secondary mt-0.5">NAMFISA Statutory Reg: 25/11/1138</p>
              </div>
            </div>

            {/* Password stage */}
            {stage === "password" && (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-space-xs">
                  <span className="text-[11px] text-primary tracking-wider uppercase font-semibold">Institutional Staff Gateway</span>
                  <span className="text-[11px] text-secondary">MFA for Admin Roles</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant" htmlFor="email">Staff Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@cashloan.tmu.na"
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                  />
                </div>
                {info && <p className="text-sm text-primary">{info}</p>}
                {error && <p className="text-sm text-error">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStage("forgot_password"); setError(null); setEmail(""); }}
                  className="w-full text-sm text-secondary hover:underline"
                >
                  Forgot password?
                </button>
              </form>
            )}

            {/* Email OTP stage */}
            {stage === "email_otp" && (
              <form onSubmit={handleEmailOtpSubmit} className="flex flex-col gap-space-md">
                <div>
                  <h1 className="text-lg font-semibold text-on-surface mb-1">Check your email</h1>
                  <p className="text-sm text-on-surface-variant">
                    We sent an 8-digit code to <span className="font-medium text-on-surface">{maskEmail(email)}</span>. Type that code here — do not click any sign-in link in other emails.
                  </p>
                  <p className={`mt-2 text-center font-mono text-lg font-semibold tabular-nums ${codeExpiresIn === 0 ? "text-error" : "text-on-surface"}`}>
                    {codeExpiresIn > 0 ? `Code expires in ${formatMmSs(codeExpiresIn)}` : "Code expired"}
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-12 px-space-md bg-surface-container-low text-on-surface text-center text-lg font-mono tracking-[0.5em] rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {error && <p className="text-sm text-error">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || code.length !== 8}
                  className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Verifying…" : "Verify & sign in"}
                </button>
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={codeExpiresIn > 0}
                    className="text-secondary hover:underline disabled:text-outline disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {codeExpiresIn > 0 ? `Resend code (${formatMmSs(codeExpiresIn)})` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStage("password"); setCode(""); setError(null); setCodeExpiresIn(0); }}
                    className="hover:underline"
                  >
                    Use a different account
                  </button>
                </div>
              </form>
            )}

            {/* Forgot password stage */}
            {stage === "forgot_password" && (
              <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-space-md">
                <div>
                  <h1 className="text-lg font-semibold text-on-surface mb-1">Reset password</h1>
                  <p className="text-sm text-on-surface-variant">Enter your email address and we&apos;ll send you a code to reset your password.</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant" htmlFor="forgot-email">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="name@example.com"
                  />
                </div>
                {error && <p className="text-sm text-error">{error}</p>}
                <button type="submit" disabled={loading} className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm">
                  {loading ? "Sending code…" : "Send reset code"}
                </button>
                <button type="button" onClick={() => { setStage("password"); setError(null); setEmail(""); }} className="w-full text-sm text-secondary hover:underline">
                  Back to sign in
                </button>
              </form>
            )}

            {stage === "reset_code" && (
              <form onSubmit={handleResetCodeSubmit} className="flex flex-col gap-space-md">
                <div>
                  <h1 className="text-lg font-semibold text-on-surface mb-1">Verify your email</h1>
                  <p className="text-sm text-on-surface-variant">
                    An 8-digit code was sent to <span className="font-medium text-on-surface">{maskEmail(email)}</span>.
                  </p>
                  <p className={`mt-2 text-center font-mono text-lg font-semibold tabular-nums ${codeExpiresIn === 0 ? "text-error" : "text-on-surface"}`}>
                    {codeExpiresIn > 0 ? `Code expires in ${formatMmSs(codeExpiresIn)}` : "Code expired"}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-11 px-space-md bg-surface-container-low text-on-surface text-center text-lg font-mono tracking-widest rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter the code from your email"
                  />
                </div>
                {error && <p className="text-sm text-error">{error}</p>}
                <button type="submit" disabled={loading || code.length !== 8} className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm">
                  {loading ? "Verifying…" : "Verify code"}
                </button>
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={codeExpiresIn > 0}
                    className="text-secondary hover:underline disabled:text-outline disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {codeExpiresIn > 0 ? `Resend code (${formatMmSs(codeExpiresIn)})` : "Resend code"}
                  </button>
                  <button type="button" onClick={() => { setStage("forgot_password"); setCode(""); setError(null); }} className="hover:underline">
                    Change email
                  </button>
                </div>
              </form>
            )}

            {stage === "reset_password" && (
              <form onSubmit={handleSaveNewPassword} className="flex flex-col gap-space-md">
                <div>
                  <h1 className="text-lg font-semibold text-on-surface mb-1">Set a new password</h1>
                  <p className="text-sm text-on-surface-variant">
                    Choose a new password for <span className="font-medium text-on-surface">{maskEmail(email)}</span>.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant">New password</label>
                  <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:ring-2 focus:ring-primary" placeholder="••••••••" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-medium text-on-surface-variant">Confirm password</label>
                  <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:ring-2 focus:ring-primary" placeholder="••••••••" />
                </div>
                {error && <p className="text-sm text-error">{error}</p>}
                <button type="submit" disabled={loading} className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm">
                  {loading ? "Saving…" : "Save new password"}
                </button>
                <button type="button" onClick={() => { setStage("reset_code"); setError(null); }} className="w-full text-sm text-secondary hover:underline">
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
