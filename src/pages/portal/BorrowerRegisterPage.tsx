import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { registerBorrower, verifyBorrowerEmail } from "../../lib/supabase/auth";

const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

function BorrowerVerificationCard({
  email,
  tempUserId,
  onBackToRegister,
}: {
  email: string;
  tempUserId: string;
  onBackToRegister: () => void;
}) {
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerificationStatus("loading");
    setErrorMessage("");
    const result = await verifyBorrowerEmail(tempUserId, code);
    if (result.success) {
      setVerificationStatus("success");
      window.location.href = "/portal?message=welcome";
    } else {
      setVerificationStatus("error");
      setErrorMessage(result.error || "Verification failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <img
            src="/brand/nexora-logo-stacked.png"
            alt="Nexora Systems"
            width={80}
            height={80}
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
            Email Verification
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            We sent a verification code to {maskEmail(email)}. Enter the code below to complete your registration.
          </p>
        </div>

        {verificationStatus === "error" && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{errorMessage}</div>
        )}

        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="Enter 8-digit code"
            />
          </div>
          <button
            type="submit"
            disabled={verificationStatus === "loading" || code.length !== 8}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
          >
            {verificationStatus === "loading" ? "Verifying..." : "Verify Email & Complete Registration"}
          </button>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={() => setResendCooldown(RESEND_COOLDOWN_SECONDS)}
              disabled={resendCooldown > 0}
              className="text-brand-blue hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
            <button type="button" onClick={onBackToRegister} className="hover:underline">
              Change email address
            </button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-600">
            Already have an account?{" "}
            <Link to="/portal/login" className="font-semibold text-brand-blue hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BorrowerRegisterPage() {
  const [email, setEmail] = useState("");
  const [tempUserId, setTempUserId] = useState("");
  const [isEditingRegistration, setIsEditingRegistration] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const showVerification = registrationStatus === "success" && tempUserId && !isEditingRegistration;

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegistrationStatus("loading");
    setErrorMessage("");
    const formData = new FormData(e.target as HTMLFormElement);
    const emailValue = formData.get("email") as string;
    setEmail(emailValue);
    const result = await registerBorrower({
      full_name: formData.get("full_name") as string,
      id_type: formData.get("id_type") as string,
      id_number: formData.get("id_number") as string,
      mobile: formData.get("mobile") as string,
      email: emailValue,
      password: formData.get("password") as string,
    });
    if (result.success && result.tempUserId) {
      setTempUserId(result.tempUserId);
      setRegistrationStatus("success");
      setIsEditingRegistration(false);
    } else {
      setRegistrationStatus("error");
      setErrorMessage(result.error || "Registration failed");
    }
  }

  if (showVerification && tempUserId) {
    return (
      <BorrowerVerificationCard
        email={email}
        tempUserId={tempUserId}
        onBackToRegister={() => setIsEditingRegistration(true)}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <img
            src="/brand/nexora-logo-stacked.png"
            alt="Nexora Systems"
            width={80}
            height={80}
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
            New Account Registration
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Borrower Account</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Connect your account with your TMU CashLoan CC records to track your application stage in real-time.
          </p>
        </div>

        {registrationStatus === "error" && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{errorMessage}</div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name (as on ID) *</label>
            <input
              name="full_name"
              type="text"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              placeholder="e.g. Johannes Shipanga"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ID Type *</label>
              <select
                name="id_type"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
              >
                <option value="personal_id">Namibian ID</option>
                <option value="passport">Passport</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Identification Number *</label>
              <input
                name="id_number"
                type="text"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="e.g. 85031200145"
              />
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-amber-800">
            💡 <strong>Tip:</strong> If you already applied at the TMU branch, please enter the exact ID number from your application so your loan records link automatically.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number *</label>
              <input
                name="mobile"
                type="tel"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="e.g. +264 81 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="johannes@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
              <input
                name="confirm_password"
                type="password"
                required
                minLength={6}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={registrationStatus === "loading"}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm mt-2"
          >
            {registrationStatus === "loading" ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-600">
            Already have an account?{" "}
            <Link to="/portal/login" className="font-semibold text-brand-blue hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
