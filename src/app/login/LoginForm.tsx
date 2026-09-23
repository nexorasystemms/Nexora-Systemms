"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { isAdminTier } from "@/lib/roles";
import { sendAdminLoginCode } from "./actions";

type Stage = "password" | "email_otp";

const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

// requireStaff()/requireRole() (src/lib/current-staff.ts) redirect here with these codes when
// a signed-in Supabase Auth user isn't a usable staff account — surface them, or the person
// just sees a blank login form again with no explanation of why they got bounced back to it.
const ERROR_MESSAGES: Record<string, string> = {
  no_staff_record: "That account isn't set up as staff yet. Contact an admin to be added.",
  inactive_account: "This account has been deactivated. Contact an admin if that's unexpected.",
  forbidden: "You don't have access to that page.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [stage, setStage] = useState<Stage>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    () => ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null,
  );
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

  // Second factor: an emailed 6-digit code for admin/super admin accounts. This verifies
  // possession of both the password and the registered inbox before granting access.
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
        {stage === "password" ? (
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
          </form>
        ) : (
          <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-1">Check your email</h1>
            <p className="text-sm text-brand-muted mb-4">
              We sent an 8-digit code to <span className="font-medium">{maskEmail(email)}</span>. It expires shortly, so
              enter it below to finish signing in.
            </p>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 8}
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
      </div>
    </div>
  );
}
