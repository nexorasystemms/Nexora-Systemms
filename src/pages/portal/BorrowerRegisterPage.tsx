import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { registerBorrower, verifyBorrowerEmail } from "../../lib/supabase/auth";

const RESEND_COOLDOWN = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

/* ─── Shared field ────────────────────────────────────────────────────────── */
function Field({
  label, name, type = "text", required, placeholder, hint,
}: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, name, required, options,
}: { label: string; name: string; required?: boolean; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <select
        id={name} name={name} required={required} defaultValue=""
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900
                   focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors appearance-none"
      >
        <option value="" disabled>Select…</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

/* ─── Verification card ──────────────────────────────────────────────────── */
function VerificationCard({
  email, tempUserId, onBack,
}: { email: string; tempUserId: string; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setStatus("loading"); setErrorMsg("");
    const r = await verifyBorrowerEmail(tempUserId, code);
    if (r.success) { window.location.href = "/portal?message=welcome"; }
    else { setStatus("error"); setErrorMsg(r.error || "Verification failed"); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-8 pb-6 text-center border-b border-slate-50">
            <img src="/brand/nexora-logo-stacked.png" alt="TMU CashLoan" className="mx-auto mb-4 h-16 w-auto object-contain" />
            <span className="inline-block px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-3">
              Email Verification
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Verify Your Email</h1>
            <p className="text-sm text-slate-500 mt-1">
              Code sent to <span className="font-medium text-slate-700">{maskEmail(email)}</span>
            </p>
          </div>

          <div className="px-6 py-6">
            {status === "error" && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">{errorMsg}</div>
            )}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="vcode" className="block text-xs font-semibold text-slate-700 mb-1.5">Verification Code</label>
                <input
                  id="vcode" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} required autoFocus
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 8-digit code"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-center tracking-[0.3em]
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                type="submit" disabled={status === "loading" || code.length !== 8}
                className="w-full py-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-sm
                           transition-all disabled:opacity-50 shadow-sm min-h-[48px]"
              >
                {status === "loading" ? "Verifying…" : "Verify Email & Complete Registration"}
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button" onClick={() => setCooldown(RESEND_COOLDOWN)} disabled={cooldown > 0}
                  className="text-indigo-700 hover:underline disabled:text-slate-400 disabled:no-underline min-h-[44px] px-1"
                >
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
                </button>
                <button type="button" onClick={onBack} className="hover:underline min-h-[44px] px-1">
                  Change email
                </button>
              </div>
            </form>
          </div>

          <div className="px-6 pb-7 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link to="/portal/login" className="font-semibold text-indigo-700 hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Registration page ─────────────────────────────────────────────────── */
export default function BorrowerRegisterPage() {
  const [email, setEmail] = useState("");
  const [tempUserId, setTempUserId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [regStatus, setRegStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const showVerify = regStatus === "success" && !!tempUserId && !isEditing;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setRegStatus("loading"); setErrorMsg("");
    const fd = new FormData(e.target as HTMLFormElement);
    const emailVal = fd.get("email") as string;
    setEmail(emailVal);

    const pw  = fd.get("password") as string;
    const cpw = fd.get("confirm_password") as string;
    if (pw !== cpw) {
      setRegStatus("error"); setErrorMsg("Passwords do not match.");
      return;
    }

    const r = await registerBorrower({
      full_name: fd.get("full_name") as string,
      id_type:   fd.get("id_type") as string,
      id_number: fd.get("id_number") as string,
      mobile:    fd.get("mobile") as string,
      email:     emailVal,
      password:  pw,
    });
    if (r.success && r.tempUserId) {
      setTempUserId(r.tempUserId); setRegStatus("success"); setIsEditing(false);
    } else {
      setRegStatus("error"); setErrorMsg(r.error || "Registration failed");
    }
  }

  if (showVerify) {
    return <VerificationCard email={email} tempUserId={tempUserId} onBack={() => setIsEditing(true)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">

          {/* ── Header ── */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-slate-50">
            <img src="/brand/nexora-logo-stacked.png" alt="TMU CashLoan" className="mx-auto mb-4 h-16 w-auto object-contain" />
            <span className="inline-block px-3 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-3">
              New Account Registration
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Create Borrower Account</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Connect your account with your TMU CashLoan CC records to track your application in real-time.
            </p>
          </div>

          {/* ── Form ── */}
          <div className="px-6 py-6">
            {regStatus === "error" && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">{errorMsg}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identity */}
              <div className="space-y-4">
                <Field label="Full Name (as on ID)" name="full_name" required placeholder="e.g. Johannes Shipanga" />
                {/* ID type + number — always stacked; sm uses 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label="ID Type" name="id_type" required
                    options={[["personal_id", "Namibian ID"], ["passport", "Passport"]]} />
                  <Field label="ID / Passport Number" name="id_number" required placeholder="e.g. 85031200145" />
                </div>
              </div>

              {/* Branch link-up tip */}
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                <strong>Tip:</strong> If you applied at the TMU branch, enter your exact ID number so your loan records link automatically.
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Mobile Phone" name="mobile" type="tel" required placeholder="+264 81 123 4567" />
                <Field label="Email Address" name="email" type="email" required placeholder="johannes@example.com" />
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Password" name="password" type="password" required placeholder="••••••••"
                  hint="At least 6 characters" />
                <Field label="Confirm Password" name="confirm_password" type="password" required placeholder="••••••••" />
              </div>

              <button
                type="submit" disabled={regStatus === "loading"}
                className="w-full py-3.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-semibold text-sm
                           transition-all disabled:opacity-50 shadow-sm min-h-[48px]"
              >
                {regStatus === "loading" ? "Creating Account…" : "Create Account"}
              </button>
            </form>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 pb-7 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link to="/portal/login" className="font-semibold text-indigo-700 hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
