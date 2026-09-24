"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { registerBorrower, sendBorrowerVerificationCode, verifyBorrowerEmail, type AuthFormState } from "../actions";

const initialState: AuthFormState = { status: "idle" };
type VerificationStage = "registration" | "email_verification";

const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default function BorrowerRegisterForm() {
  const [registerState, registerAction, registerPending] = useActionState(registerBorrower, initialState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyBorrowerEmail, initialState);
  
  const [stage, setStage] = useState<VerificationStage>("registration");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check for successful registration without using useEffect for state updates
  const isRegistrationSuccessful = registerState.status === "success" && registerState.tempUserId;
  const currentStage = isRegistrationSuccessful ? "email_verification" : stage;
  const currentTempUserId = isRegistrationSuccessful ? registerState.tempUserId : tempUserId;

  // Set cooldown when moving to verification stage
  useEffect(() => {
    if (isRegistrationSuccessful && resendCooldown === 0) {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }, [isRegistrationSuccessful, resendCooldown]);

  async function handleResendCode() {
    if (resendCooldown > 0 || !currentTempUserId) return;
    
    const result = await sendBorrowerVerificationCode(currentTempUserId);
    if (result.ok) {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  const state = currentStage === "registration" ? registerState : verifyState;
  const pending = currentStage === "registration" ? registerPending : verifyPending;

  return (
    <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
      <div className="text-center mb-6">
        <Image
          src="/brand/nexora-logo-stacked.png"
          alt="Nexora Systems"
          width={80}
          height={80}
          className="mx-auto mb-2"
          priority
        />
        <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
          {currentStage === "registration" ? "New Account Registration" : "Email Verification"}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {currentStage === "registration" ? "Create Borrower Account" : "Verify Your Email"}
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          {currentStage === "registration" 
            ? "Connect your account with your TMU CashLoan CC records to track your application stage in real-time."
            : `We sent a verification code to ${maskEmail(email)}. Enter the code below to complete your registration.`
          }
        </p>
      </div>

      {state.status === "error" && (
        <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {state.message}
        </div>
      )}

      {currentStage === "registration" ? (
        <form 
          action={(formData: FormData) => {
            const emailValue = formData.get("email") as string;
            setEmail(emailValue);
            registerAction(formData);
          }} 
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name (as on ID) *
            </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ID Type *
              </label>
              <select
                name="id_type"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
              >
                <option value="personal_id">Namibian ID</option>
                <option value="passport">Passport</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Identification Number *
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Phone Number *
              </label>
              <input
                name="mobile"
                type="tel"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="e.g. +264 81 123 4567"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address *
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password *
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password *
              </label>
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
            disabled={pending}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm mt-2"
          >
            {pending ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      ) : (
        <form 
          action={(formData: FormData) => {
            formData.set("temp_user_id", currentTempUserId || "");
            verifyAction(formData);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verification Code
            </label>
            <input
              name="verification_code"
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
            disabled={verifyPending || code.length !== 8}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
          >
            {verifyPending ? "Verifying..." : "Verify Email & Complete Registration"}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              className="text-brand-blue hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("registration");
                setCode("");
                setTempUserId(null);
              }}
              className="hover:underline"
            >
              Change email address
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-600">
          Already have an account?{" "}
          <Link href="/portal/login" className="font-semibold text-brand-blue hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
