import { useState, useTransition } from "react";
import type { AgreementRow, ApplicationStatus } from "../../types/database";
import { borrowerAcceptAgreement } from "../../lib/supabase/stubs";

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
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm text-center">
        <h3 className="text-base font-bold text-on-surface mb-1">Loan Agreement</h3>
        <p className="text-[12px] text-on-surface-variant">
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
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md border-b border-outline-variant/30 gap-space-sm">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-secondary-container/40 px-space-sm py-0.5 rounded-full">
            Official Agreement #{agreement.reference_number}
          </span>
          <h3 className="text-lg font-bold text-on-surface mt-1">Loan Contract &amp; Terms</h3>
        </div>
        <div>
          {accepted || status === "disbursed" || status === "performing" ? (
            <span className="text-[12px] px-space-md py-1 rounded-full font-semibold bg-tertiary-fixed/40 text-tertiary-container flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">check_circle</span> Accepted by Borrower
            </span>
          ) : isPendingSignature ? (
            <span className="text-[12px] px-space-md py-1 rounded-full font-semibold bg-secondary-container text-on-secondary-container">
              Awaiting Your Acceptance
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md py-space-lg border-b border-outline-variant/30">
        <div className="p-space-md bg-surface-container-low rounded-xl">
          <div className="text-[12px] text-on-surface-variant font-medium">Principal Amount</div>
          <div className="text-xl font-bold text-on-surface mt-0.5 font-mono">
            N${Number(agreement.principal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Amount to be disbursed</div>
        </div>
        <div className="p-space-md bg-surface-container-low rounded-xl">
          <div className="text-[12px] text-on-surface-variant font-medium">Finance Charge (Capped)</div>
          <div className="text-xl font-bold text-on-surface mt-0.5 font-mono">
            N${Number(agreement.finance_charge).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-tertiary-container mt-0.5">Strictly compliant with NAMFISA cap</div>
        </div>
        <div className="p-space-md bg-secondary-container/30 rounded-xl">
          <div className="text-[12px] text-on-secondary-container font-medium">Total Amount Repayable</div>
          <div className="text-xl font-bold text-on-secondary-container mt-0.5 font-mono">
            N${Number(agreement.total_repayable).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-on-secondary-container/80 mt-0.5">Principal + finance charges</div>
        </div>
      </div>

      {isPendingSignature && !accepted && (
        <div className="mt-space-lg p-space-md rounded-xl bg-secondary-container/30">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-secondary-container mb-space-sm">
            Review &amp; Accept Your Agreement
          </h4>
          <p className="text-[12px] text-on-secondary-container mb-space-md leading-relaxed">
            By accepting, you confirm that you have agreed to the repayment terms outlined above.
            Disbursement will be initiated by TMU CashLoan CC upon electronic signing.
          </p>
          {error && (
            <div className="mb-space-sm p-space-sm bg-error-container rounded-lg text-[12px] text-on-error-container">{error}</div>
          )}
          <label className="flex items-start gap-2.5 text-[12px] text-on-surface cursor-pointer mb-space-md">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              I, the borrower, confirm that I have reviewed the loan terms, interest calculations, and repayment dates, and I accept this agreement.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={pending || !agreedToTerms}
            className="w-full sm:w-auto px-space-lg py-space-sm rounded-lg bg-primary text-on-primary font-semibold text-[12px] transition disabled:opacity-50 shadow-sm hover:opacity-90"
          >
            {pending ? "Accepting..." : "Digitally Accept Loan Agreement"}
          </button>
        </div>
      )}

      {(accepted || status === "disbursed" || status === "performing") && (
        <div className="mt-space-md p-space-md rounded-xl bg-tertiary-fixed/20 text-[12px] text-tertiary-container flex items-center justify-between flex-wrap gap-space-xs">
          <div>
            <strong>Agreement Status:</strong> Accepted digitally
            {agreement.acceptance_timestamp && ` on ${new Date(agreement.acceptance_timestamp).toLocaleString()}`}
          </div>
          <span className="font-mono text-[10px]">Hash: {agreement.pdf_sha256_hash?.slice(0, 12)}...</span>
        </div>
      )}
    </div>
  );
}
