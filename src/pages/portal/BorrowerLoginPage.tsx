import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { TMU_ROOT, tmuAssets, tmuPortal } from "../../lib/tenants";
import { loginBorrower, sendPasswordResetCode, verifyPasswordResetCode, completePasswordReset } from "../../lib/supabase/auth";

type Stage = "login" | "forgot_password" | "reset_code" | "reset_password";
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
        className="w-full min-h-11 px-4 py-3 rounded-xl border border-outline bg-white text-base text-on-surface placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
      />
    </div>
  );
}

function PrimaryBtn({ loading, label, loadingLabel, disabled }: { loading: boolean; label: string; loadingLabel: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3.5 px-4 rounded-xl bg-tertiary hover:opacity-90 active:scale-[0.98] text-on-tertiary font-semibold text-sm
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
      className="w-full text-sm text-secondary hover:text-on-surface py-2 min-h-[44px] transition-colors"
    >
      {children}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function BorrowerLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => {
    const message = searchParams.get("message");
    if (message === "password-updated") return "Password updated. Sign in with your new password and current email.";
    if (message === "email-changed") return "Email updated. Sign in with your new email address.";
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCooldown((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await loginBorrower(email.trim().toLowerCase(), password);
    if (r.success) { navigate(tmuPortal.home); }
    else { setError(r.error || "Login failed"); setLoading(false); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setError(null); setInfo(null); setLoading(true);
    const r = await sendPasswordResetCode(email.trim().toLowerCase());
    if (!r.success) { setError(r.error || "Could not send code."); setLoading(false); return; }
    setStage("reset_code"); setCode(""); setLoading(false); setCooldown(CODE_TTL_SECONDS);
  }

  async function handleVerifyResetCode(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await verifyPasswordResetCode(email.trim().toLowerCase(), code);
    if (!r.success) { setError(r.error || "Invalid or expired verification code"); setLoading(false); return; }
    setStage("reset_password"); setNewPw(""); setConfirmPw(""); setLoading(false);
  }

  async function handleSaveNewPassword(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }
    if (newPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const r = await completePasswordReset(newPw);
    if (!r.success) { setError(r.error || "Failed to reset password"); setLoading(false); return; }
    setStage("login");
    setPassword(""); setNewPw(""); setConfirmPw(""); setCode("");
    setInfo("Password updated. Sign in with your new password and current email.");
    setLoading(false);
  }

  async function handleResend() {
    if (cooldown > 0) return; setError(null);
    const r = await sendPasswordResetCode(email.trim().toLowerCase());
    if (r.success) setCooldown(CODE_TTL_SECONDS); else setError(r.error ?? "Could not resend code.");
  }

  const stageTitle =
    stage === "login" ? "Track Your Cash Loan"
    : stage === "forgot_password" ? "Reset Password"
    : stage === "reset_code" ? "Verify Your Email"
    : "Set a new password";

  return (
    /* Full-screen centred layout — px-4 ensures card never touches screen edge */
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">

          {/* ── Card header ── */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-slate-50">
            <Link to={TMU_ROOT}>
              <img
                src={tmuAssets.stacked}
                alt="TMU Capital Pty Ltd"
                className="mx-auto mb-4 h-12 w-[220px] object-contain"
              />
            </Link>
            <span className="inline-block px-3 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold mb-3">
              Borrower Portal
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{stageTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">TMU CashLoan CC · Windhoek, Namibia</p>
          </div>

          {/* ── Card body ── */}
          <div className="px-6 py-6 space-y-4">
            {info && (
              <div className="p-3.5 rounded-xl bg-secondary-container border border-secondary-container text-xs text-on-secondary-container">{info}</div>
            )}
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

            {stage === "reset_code" && (
              <form onSubmit={handleVerifyResetCode} className="space-y-4">
                <p className="text-sm text-slate-500">
                  An 8-digit code was sent to <span className="font-medium text-slate-700">{maskEmail(email)}</span>
                </p>
                <p className={`text-center font-mono text-lg font-semibold tabular-nums ${cooldown === 0 ? "text-rose-600" : "text-slate-800"}`}>
                  {cooldown > 0 ? `Code expires in ${formatMmSs(cooldown)}` : "Code expired"}
                </p>
                <Field label="Verification Code" id="code" value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, ""))}
                  placeholder="Enter the code from your email" inputMode="numeric" pattern="[0-9]*" maxLength={8}
                  required autoFocus />
                <PrimaryBtn loading={loading} label="Verify code" loadingLabel="Verifying…" disabled={code.length !== 8} />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button" onClick={handleResend} disabled={cooldown > 0}
                    className="text-secondary hover:underline disabled:text-slate-400 disabled:no-underline min-h-[44px] px-1"
                  >
                    {cooldown > 0 ? `Resend (${formatMmSs(cooldown)})` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStage("forgot_password"); setCode(""); setError(null); }}
                    className="hover:underline min-h-[44px] px-1"
                  >
                    Change email
                  </button>
                </div>
              </form>
            )}

            {stage === "reset_password" && (
              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Choose a new password for <span className="font-medium text-slate-700">{maskEmail(email)}</span>.
                </p>
                <Field label="New Password" id="new-pw" type="password" value={newPw} onChange={setNewPw}
                  placeholder="••••••••" required />
                <Field label="Confirm Password" id="confirm-pw" type="password" value={confirmPw} onChange={setConfirmPw}
                  placeholder="••••••••" required />
                <PrimaryBtn loading={loading} label="Save new password" loadingLabel="Saving…" />
                <GhostBtn onClick={() => { setStage("reset_code"); setError(null); }}>
                  ← Back
                </GhostBtn>
              </form>
            )}
          </div>

          {/* ── Card footer ── */}
          <div className="px-6 pb-7 text-center space-y-2">
            <p className="text-xs text-slate-500">
              New to TMU online?{" "}
              <Link to={tmuPortal.register} className="font-semibold text-secondary hover:underline">
                Create an Account
              </Link>
            </p>
            <p className="text-[11px] text-slate-400">
              <Link to={TMU_ROOT} className="text-slate-500 hover:underline">Back to TMU Investments</Link>
              {" · "}
              Staff?{" "}
              <Link to="/login" className="text-slate-500 hover:underline">Go to Staff Console</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
