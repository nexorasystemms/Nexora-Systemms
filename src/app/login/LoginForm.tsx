"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Stage = "password" | "otp";

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
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Second factor: an emailed 6-digit code, not an authenticator app. NOTE — this is a UI-level
  // gate, not enforced session/AAL-level MFA the way TOTP is: signInWithPassword already issues
  // a fully valid session before this code is ever checked, since Supabase has no "email" MFA
  // factor type to layer on top of it. Requiring this step is a deliberate, documented weakening
  // of the SRS's FR-CORE-03 control — see README §"Staff login" before relying on it for go-live.
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStage("otp");
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setInfo("A new code is on its way.");
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
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-brand-navy mb-4">Enter the verification code sent to your email</h1>
            {info && <p className="text-sm text-brand-muted mb-4">{info}</p>}

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-brand-border px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>

            <button type="button" onClick={handleResend} className="w-full text-sm text-brand-blue hover:underline">
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
