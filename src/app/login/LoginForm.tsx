"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { isAdminTier } from "@/lib/roles";
import { sendAdminLoginCode, sendAdminPasswordReset } from "./actions";

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
    const result = await sendAdminLoginCode(targetEmail);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.user) {
      setError(signInError?.message ?? "Could not sign in.");
      setLoading(false);
      return;
    }

    const { data: staff } = await supabase
      .from("users")
      .select("role")
      .eq("id", signInData.user.id)
      .single();

    // Admins and super admins get a one-time code emailed to them on every login to verify
    // possession of both the password and the registered inbox before granting access.
    if (staff && isAdminTier(staff.role)) {
      // Drop the password-only session immediately: nothing should be reachable with just a
      // password until the emailed code is also verified.
      await supabase.auth.signOut();

      const sent = await sendEmailOtp(email);
      if (!sent) {
        setLoading(false);
        return;
      }
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
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "magiclink",
    });

    if (verifyError) {
      setError(verifyError.message);
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

    const result = await sendAdminPasswordReset(email);
    if (!result.ok) {
      setError(result.message);
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
    const supabase = createClient();

    // Verify the code and set new password
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });

    if (verifyError || !verifyData.user) {
      setError("Invalid or expired password reset code.");
      setLoading(false);
      return;
    }

    // Update password using the authenticated session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Sign out and go back to login
    await supabase.auth.signOut();
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
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8">
        <Image src="/brand/nexora-logo-stacked.png" alt="Nexora Systems" width={140} height={140} priority />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl shadow-sm p-8">
        {stage === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-1">Staff sign in</h1>
            <p className="text-sm text-brand-muted mb-4">Cash Loan Console — TMU CashLoan CC pilot</p>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
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
              className="w-full text-sm text-brand-blue hover:underline"
            >
              Forgot password?
            </button>
          </form>
        )}

        {stage === "email_otp" && (
          <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-1">Check your email</h1>
            <p className="text-sm text-brand-muted mb-4">
              We sent a 6-digit code to <span className="font-medium">{maskEmail(email)}</span>. It expires shortly, so
              enter it below to finish signing in.
            </p>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>

            <div className="flex items-center justify-between text-xs text-brand-muted">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-brand-blue hover:underline disabled:text-brand-muted disabled:no-underline disabled:cursor-not-allowed"
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
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-1">Reset password</h1>
            <p className="text-sm text-brand-muted mb-4">
              Enter your email address and we&apos;ll send you a code to reset your password.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="name@example.com"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
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
              className="w-full text-sm text-brand-blue hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}

        {stage === "reset_code" && (
          <form onSubmit={handleResetCodeSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-1">Enter reset code</h1>
            <p className="text-sm text-brand-muted mb-4">
              We sent a code to <span className="font-medium">{maskEmail(email)}</span>. Enter it below and create a new password.
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="Enter 8-digit code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 8}
              className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
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
              className="w-full text-sm text-brand-blue hover:underline"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
