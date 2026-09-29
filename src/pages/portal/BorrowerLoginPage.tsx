import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginBorrower, sendPasswordResetCode, resetPassword } from "../../lib/supabase/auth";

type Stage = "login" | "forgot_password" | "reset_code";
const RESEND_COOLDOWN = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

/* ─── Shared field atoms ─────────────────────────────────────────────────── */
function Field({
  label, id, type = "text", value, onChange, placeholder, autoComplete, required, autoFocus, maxLength, inputMode, pattern,
}: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
  required?: boolean; autoFocus?: boolean; maxLength?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        id={id} name={id} type={type} value={value} required={required} autoFocus={autoFocus}
        autoComplete={autoComplete} placeholder={placeholder} maxLength={maxLength}
        inputMode={inputMode} pattern={pattern}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
      />
    </div>
  );
}

function PrimaryBtn({ loading, label, loadingLabel, disabled }: { loading: boolean; label: string; loadingLabel: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3.5 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-800 active:scale-[0.98] text-white font-semibold text-sm
                 transition-all disabled:opacity-50 shadow-sm min-h-[48px]"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-sm text-indigo-700 hover:text-indigo-900 py-2 min-h-[44px] transition-colors"
    >
      {children}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function BorrowerLoginPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await loginBorrower(email.trim().toLowerCase(), password);
    if (r.success) { navigate("/portal"); }
    else { setError(r.error || "Login failed"); setLoading(false); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await sendPasswordResetCode(email.trim().toLowerCase());
    if (!r.success) { setError(r.error || "Could not send code."); setLoading(false); return; }
    setStage("reset_code"); setCode(""); setLoading(false); setCooldown(RESEND_COOLDOWN);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    if (newPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const r = await resetPassword(email.trim().toLowerCase(), code, newPw);
    if (!r.success) { setError(r.error || "Failed to reset password"); setLoading(false); return; }
    setStage("login"); setEmail(""); setPassword(""); setNewPw(""); setConfirmPw(""); setCode(""); setLoading(false);
  }

  async function handleResend() {
    if (cooldown > 0) return; setError(null);
    const r = await sendPasswordResetCode(email.trim().toLowerCase());
    if (r.success) setCooldown(RESEND_COOLDOWN); else setError(r.error ?? "Could not resend code.");
  }

  const stageTitle =
    stage === "login" ? "Track Your Cash Loan"
    : stage === "forgot_password" ? "Reset Password"
    : "Enter Reset Code";

  return (
    /* Full-screen centred layout — px-4 ensures card never touches screen edge */
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">

          {/* ── Card header ── */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-slate-50">
            <img
              src="/brand/nexora-logo-stacked.png"
              alt="TMU CashLoan"
              className="mx-auto mb-4 h-16 w-auto object-contain"
            />
            <span className="inline-block px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-3">
              Borrower Portal
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{stageTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">TMU CashLoan CC · Windhoek, Namibia</p>
          </div>

          {/* ── Card body ── */}
          <div className="px-6 py-6 space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">{error}</div>
            )}

            {/* Login form */}
            {stage === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email Address" id="email" type="email" value={email} onChange={setEmail}
                  placeholder="name@example.com" autoComplete="email" required />
                <Field label="Password" id="password" type="password" value={password} onChange={setPassword}
                  placeholder="••••••••" autoComplete="current-password" required />
                <PrimaryBtn loading={loading} label="Sign In to Portal" loadingLabel="Signing in…" />
                <GhostBtn onClick={() => { setStage("forgot_password"); setError(null); setEmail(""); }}>
                  Forgot your password?
                </GhostBtn>
              </form>
            )}

            {/* Forgot password form */}
            {stage === "forgot_password" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-slate-500">Enter your email and we'll send a reset code.</p>
                <Field label="Email Address" id="email-forgot" type="email" value={email} onChange={setEmail}
                  placeholder="name@example.com" autoComplete="email" required />
                <PrimaryBtn loading={loading} label="Send Reset Code" loadingLabel="Sending…" />
                <GhostBtn onClick={() => { setStage("login"); setError(null); setEmail(""); setPassword(""); }}>
                  ← Back to sign in
                </GhostBtn>
              </form>
            )}

            {/* Reset code form */}
            {stage === "reset_code" && (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Code sent to <span className="font-medium text-slate-700">{maskEmail(email)}</span>.
                </p>
                <Field label="Verification Code" id="code" value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, ""))}
                  placeholder="8-digit code" inputMode="numeric" pattern="[0-9]*" maxLength={8}
                  required autoFocus />
                <Field label="New Password" id="new-pw" type="password" value={newPw} onChange={setNewPw}
                  placeholder="••••••••" required />
                <Field label="Confirm Password" id="confirm-pw" type="password" value={confirmPw} onChange={setConfirmPw}
                  placeholder="••••••••" required />
                <PrimaryBtn loading={loading} label="Reset Password" loadingLabel="Resetting…" disabled={code.length !== 8} />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button" onClick={handleResend} disabled={cooldown > 0}
                    className="text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline min-h-[44px] px-1"
                  >
                    {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStage("forgot_password"); setCode(""); setError(null); }}
                    className="hover:underline min-h-[44px] px-1"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Card footer ── */}
          <div className="px-6 pb-7 text-center space-y-2">
            <p className="text-xs text-slate-500">
              New to TMU online?{" "}
              <Link to="/portal/register" className="font-semibold text-indigo-700 hover:underline">
                Create an Account
              </Link>
            </p>
            <p className="text-[11px] text-slate-400">
              Staff?{" "}
              <Link to="/login" className="text-slate-500 hover:underline">Go to Staff Console</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
