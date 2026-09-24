"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendBorrowerPasswordReset } from "../actions";

type Stage = "login" | "forgot_password" | "reset_code" | "new_password";

const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default function BorrowerLoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    // Verify role in public.users
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("User profile not found. If you are a new applicant, please register first.");
      setLoading(false);
      return;
    }

    if (profile.status !== "active") {
      await supabase.auth.signOut();
      setError("Your email address has not been verified yet. Please check your email for a verification code.");
      setLoading(false);
      return;
    }

    if (profile.role !== "borrower") {
      await supabase.auth.signOut();
      setError("Staff members must sign in through the internal staff portal at /login.");
      setLoading(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await sendBorrowerPasswordReset(email.trim().toLowerCase());
    if (!result.ok) {
      setError(result.message ?? "Could not send the reset code.");
      setLoading(false);
      return;
    }

    setStage("reset_code");
    setCode("");
    setLoading(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
      email: email.trim().toLowerCase(),
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
    setStage("login");
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
    
    const result = await sendBorrowerPasswordReset(email.trim().toLowerCase());
    if (result.ok) {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setError(result.message ?? "Could not send the reset code.");
    }
  }

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <Image
          src="/brand/nexora-logo-stacked.png"
          alt="Nexora Systems"
          width={90}
          height={90}
          className="mx-auto mb-3"
          priority
        />
        <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
          Borrower Portal
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {stage === "login" ? "Track Your Cash Loan" : stage === "forgot_password" ? "Reset Password" : "Enter Reset Code"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          TMU CashLoan CC · Windhoek, Namibia
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {stage === "login" && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
          >
            {loading ? "Signing in..." : "Sign In to Portal"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStage("forgot_password");
              setError(null);
              setEmail("");
            }}
            className="w-full text-sm text-brand-blue hover:underline py-1"
          >
            Forgot your password?
          </button>
        </form>
      )}

      {stage === "forgot_password" && (
        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 mb-4">
            Enter your email address and we&apos;ll send you a code to reset your password.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="name@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
          >
            {loading ? "Sending code..." : "Send Reset Code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStage("login");
              setError(null);
              setEmail("");
              setPassword("");
            }}
            className="w-full text-sm text-brand-blue hover:underline py-1"
          >
            Back to sign in
          </button>
        </form>
      )}

      {stage === "reset_code" && (
        <form onSubmit={handleResetCodeSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 mb-4">
            We sent a code to <span className="font-medium">{maskEmail(email)}</span>. Enter it below and create a new password.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="Enter 8-digit code"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 8}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-brand-blue hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("forgot_password");
                setCode("");
                setError(null);
              }}
              className="hover:underline"
            >
              Back
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-600">
          Applied in person or new to TMU online?{" "}
          <Link href="/portal/register" className="font-semibold text-brand-blue hover:underline">
            Create an Account
          </Link>
        </p>
        <p className="text-[11px] text-slate-400 mt-3">
          Staff member?{" "}
          <Link href="/login" className="text-slate-500 hover:underline">
            Go to Staff Console
          </Link>
        </p>
      </div>
    </div>
  );
}
