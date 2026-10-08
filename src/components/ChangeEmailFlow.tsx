import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { requestEmailChange, verifyEmailChange, resendEmailChangeCode } from "@/lib/supabase/auth";

const RESEND_COOLDOWN = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default function ChangeEmailFlow({
  loginPath,
  currentEmail,
}: {
  loginPath: string;
  currentEmail?: string;
}) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await requestEmailChange(newEmail);
    if (!r.success) {
      setError(r.error || "Could not send a verification code.");
      setLoading(false);
      return;
    }
    setStage("verify");
    setCode("");
    setLoading(false);
    setCooldown(RESEND_COOLDOWN);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await verifyEmailChange(newEmail, code);
    if (!r.success) {
      setError(r.error || "Verification failed");
      setLoading(false);
      return;
    }
    navigate(`${loginPath}?message=email-changed`, { replace: true });
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    const r = await resendEmailChangeCode(newEmail);
    if (r.success) setCooldown(RESEND_COOLDOWN);
    else setError(r.error || "Could not resend the code.");
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden max-w-md">
      <div className="px-6 pt-6 pb-4 border-b border-slate-50">
        <span className="inline-block px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-3">
          Account
        </span>
        <h2 className="text-xl font-bold text-slate-900">
          {stage === "enter" ? "Change email address" : "Verify your new email"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {stage === "enter"
            ? currentEmail
              ? `Current email: ${maskEmail(currentEmail)}`
              : "A verification code will be sent to the new address."
            : `Code sent to ${maskEmail(newEmail)}`}
        </p>
      </div>

      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">{error}</div>
        )}

        {stage === "enter" && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label htmlFor="new-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                New email address
              </label>
              <input
                id="new-email"
                type="email"
                required
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-sm
                         transition-all disabled:opacity-50 shadow-sm min-h-[48px]"
            >
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {stage === "verify" && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="email-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Verification Code
              </label>
              <input
                id="email-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter the code from your email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-center tracking-[0.3em]
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 8}
              className="w-full py-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-sm
                         transition-all disabled:opacity-50 shadow-sm min-h-[48px]"
            >
              {loading ? "Verifying…" : "Verify new email"}
            </button>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline min-h-[44px] px-1"
              >
                {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => { setStage("enter"); setCode(""); setError(null); }}
                className="hover:underline min-h-[44px] px-1"
              >
                Change email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
