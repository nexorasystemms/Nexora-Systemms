"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { isAdminTier } from "@/lib/roles";
import { 
  loginAdmin, 
  verifyAdminLogin, 
  sendPasswordResetCode, 
  resetPassword 
} from "@/lib/supabase/auth";

type Stage = "password" | "email_otp" | "forgot_password" | "reset_code" | "new_password";

const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [stage, setStage] = useState<Stage>("password");
  const [tempUserId, setTempUserId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function sendEmailOtp(targetEmail: string) {
    const result = await sendPasswordResetCode(targetEmail);
    if (!result.success) {
      setError(result.error || 'Failed to send verification code');
      return false;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Use client-side auth
    const result = await loginAdmin(email, password);
    if (!result.success) {
      setError(result.error || 'Login failed');
      setLoading(false);
      return;
    }

    // Check if requires verification
    if (result.requiresVerification && result.tempUserId) {
      setTempUserId(result.tempUserId);
      setStage("email_otp");
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleEmailOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Verify the admin login with our client-side auth
    const result = await verifyAdminLogin(tempUserId, code);
    if (!result.success) {
      setError(result.error || 'Invalid verification code');
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await sendPasswordResetCode(email);
    if (!result.success) {
      setError(result.error || 'Failed to send reset code');
      setLoading(false);
      return;
    }

    setStage("reset_code");
    setCode("");
    setLoading(false);
  }

  async function handleResetCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    // Use client-side password reset
    const result = await resetPassword(email, code, newPassword);
    if (!result.success) {
      setError(result.error || 'Failed to reset password');
      setLoading(false);
      return;
    }

    // Success - go back to login
    setError(null);
    setStage("password");
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCode("");
    setLoading(false);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    await sendEmailOtp(email);
  }

  return (
    <div data-surface="admin" className="w-full max-w-md">
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 bottom-10 h-48 w-48 rounded-full bg-tertiary-fixed/15 blur-2xl pointer-events-none" />
        <div className="relative p-margin-desktop flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm">
              <Image src="/brand/nexora-mark.png" alt="Nexora Systems" width={32} height={32} priority />
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
                onClick={() => {
                  setStage("forgot_password");
                  setError(null);
                  setEmail("");
                }}
                className="w-full text-sm text-secondary hover:underline"
              >
                Forgot password?
              </button>
            </form>
          )}

          {stage === "email_otp" && (
            <form onSubmit={handleEmailOtpSubmit} className="flex flex-col gap-space-md">
              <div>
                <h1 className="text-lg font-semibold text-on-surface mb-1">Check your email</h1>
                <p className="text-sm text-on-surface-variant">
                  We sent a 6-digit code to <span className="font-medium text-on-surface">{maskEmail(email)}</span>. It expires shortly, so
                  enter it below to finish signing in.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full h-12 px-space-md bg-surface-container-low text-on-surface text-center text-lg font-mono tracking-[0.5em] rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Verifying…" : "Verify & sign in"}
              </button>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="text-secondary hover:underline disabled:text-outline disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStage("password");
                    setCode("");
                    setError(null);
                  }}
                  className="hover:underline"
                >
                  Use a different account
                </button>
              </div>
            </form>
          )}

          {stage === "forgot_password" && (
            <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-space-md">
              <div>
                <h1 className="text-lg font-semibold text-on-surface mb-1">Reset password</h1>
                <p className="text-sm text-on-surface-variant">
                  Enter your email address and we&apos;ll send you a code to reset your password.
                </p>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Sending code…" : "Send reset code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage("password");
                  setError(null);
                  setEmail("");
                }}
                className="w-full text-sm text-secondary hover:underline"
              >
                Back to sign in
              </button>
            </form>
          )}

          {stage === "reset_code" && (
            <form onSubmit={handleResetCodeSubmit} className="flex flex-col gap-space-md">
              <div>
                <h1 className="text-lg font-semibold text-on-surface mb-1">Enter reset code</h1>
                <p className="text-sm text-on-surface-variant">
                  We sent a code to <span className="font-medium text-on-surface">{maskEmail(email)}</span>. Enter it below and create a new password.
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
                  placeholder="Enter 8-digit code"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-on-surface-variant">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-on-surface-variant">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-9 px-space-md bg-surface-container-low text-on-surface text-sm rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 8}
                className="w-full h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage("forgot_password");
                  setCode("");
                  setError(null);
                }}
                className="w-full text-sm text-secondary hover:underline"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
