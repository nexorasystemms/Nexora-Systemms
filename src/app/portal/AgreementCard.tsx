"use client";

import { useState, useTransition } from "react";
import type { AgreementRow, ApplicationStatus } from "@/types/database";
import { borrowerAcceptAgreement } from "./actions";

export default function AgreementCard({
  applicationId,
  status,
  agreement,
}: {
  applicationId: string;
  status: ApplicationStatus;
  agreement: AgreementRow | null;
}) {
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(status === "agreement_accepted");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agreement) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center">
        <h3 className="text-base font-bold text-slate-900 mb-1">Loan Agreement</h3>
        <p className="text-xs text-slate-500">
          Your formal loan agreement will be generated here once your affordability assessment and branch review are approved.
        </p>
      </div>
    );
  }

  const isPendingSignature = status === "agreement_generated";

  async function handleAccept() {
    if (!agreedToTerms) {
      setError("Please confirm that you have read and agree to the loan agreement terms.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await borrowerAcceptAgreement(applicationId, agreement!.id);
        setAccepted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept agreement.");
      }
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            Official Agreement #{agreement.reference_number}
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">Loan Contract & Terms</h3>
        </div>

        <div>
          {accepted || status === "disbursed" || status === "performing" ? (
            <span className="text-xs px-3 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <span>✓</span> Accepted by Borrower
            </span>
          ) : isPendingSignature ? (
            <span className="text-xs px-3 py-1 rounded-full font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Awaiting Your Acceptance
            </span>
          ) : null}
        </div>
      </div>

      {/* Figures Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5 border-b border-slate-100">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
          <div className="text-xs text-slate-500 font-medium">Principal Amount</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            N${Number(agreement.principal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Amount to be disbursed</div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
          <div className="text-xs text-slate-500 font-medium">Finance Charge (Capped)</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            N${Number(agreement.finance_charge).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-teal-600 mt-0.5">Strictly compliant with NAMFISA cap</div>
        </div>

        <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200/60">
          <div className="text-xs text-teal-800 font-medium">Total Amount Repayable</div>
          <div className="text-xl font-extrabold text-teal-900 mt-0.5">
            N${Number(agreement.total_repayable).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-teal-700 mt-0.5">Principal + finance charges</div>
        </div>
      </div>

      {/* Acceptance Section */}
      {isPendingSignature && !accepted && (
        <div className="mt-5 p-4 rounded-xl bg-blue-50/80 border border-blue-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">
            Review & Accept Your Agreement
          </h4>
          <p className="text-xs text-blue-800 mb-4 leading-relaxed">
            By accepting, you confirm that you have agreed to the repayment terms outlined above.
            Disbursement will be initiated by TMU CashLoan CC upon electronic signing.
          </p>

          {error && (
            <div className="mb-3 p-2.5 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              I, the borrower, confirm that I have reviewed the loan terms, interest calculations, and repayment dates, and I accept this agreement.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={pending || !agreedToTerms}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition disabled:opacity-50 shadow-xs"
          >
            {pending ? "Accepting..." : "Digitally Accept Loan Agreement"}
          </button>
        </div>
      )}

      {(accepted || status === "disbursed" || status === "performing") && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div>
            <strong>Agreement Status:</strong> Accepted digitally
            {agreement.acceptance_timestamp && ` on ${new Date(agreement.acceptance_timestamp).toLocaleString()}`}
          </div>
          <span className="font-mono text-[10px] text-emerald-600">
            Hash: {agreement.pdf_sha256_hash?.slice(0, 12)}...
          </span>
        </div>
      )}
    </div>
  );
}
