"use client";

import type { ApplicationStatus } from "@/types/database";

interface StageTrackerProps {
  status: ApplicationStatus;
  nextPayDate: string | null;
  amountRequested: number;
  approvedAmount?: number | null;
}

interface Step {
  id: number;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, label: "Submitted", description: "Application received" },
  { id: 2, label: "Under Review", description: "Document & income check" },
  { id: 3, label: "Assessment", description: "Affordability & decision" },
  { id: 4, label: "Agreement", description: "Contract ready for signing" },
  { id: 5, label: "Disbursed", description: "Funds paid out" },
];

export default function StageTracker({
  status,
  nextPayDate,
  amountRequested,
  approvedAmount,
}: StageTrackerProps) {
  // Determine current active step (1 to 5)
  let currentStep = 1;
  const isDeclined = status === "declined";
  const isAwaitingDocs = status === "awaiting_documents";
  const isSettled = status === "settled";
  const isInArrears = status === "in_arrears";

  switch (status) {
    case "draft":
    case "submitted":
      currentStep = 1;
      break;
    case "under_review":
    case "awaiting_documents":
      currentStep = 2;
      break;
    case "assessed":
      currentStep = 3;
      break;
    case "approved":
    case "approved_with_changes":
    case "agreement_generated":
      currentStep = 4;
      break;
    case "agreement_accepted":
    case "disbursed":
    case "performing":
    case "in_arrears":
    case "settled":
    case "handed_over":
      currentStep = 5;
      break;
    default:
      currentStep = 1;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Current Application Progress
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            {isDeclined
              ? "Application Decision: Declined"
              : isSettled
              ? "Loan Completed & Settled 🎉"
              : isInArrears
              ? "Account In Arrears"
              : isAwaitingDocs
              ? "Action Required: Additional Documents"
              : status === "agreement_generated"
              ? "Action Required: Sign Loan Agreement"
              : status === "disbursed" || status === "performing"
              ? "Active Loan — Performing"
              : `Stage ${currentStep} of 5: ${STEPS[currentStep - 1]?.label}`}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Requested:</span>
          <span className="text-sm font-bold text-slate-900">
            N${amountRequested.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
          {approvedAmount && approvedAmount !== amountRequested && (
            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-200">
              Approved: N${approvedAmount.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Visual Stepper */}
      <div className="py-6 overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="relative flex items-center justify-between">
            {/* Background connecting line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-slate-100 -z-0" />
            {/* Active connecting line */}
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 -z-0 transition-all duration-500 ${
                isDeclined ? "bg-red-300" : "bg-teal-600"
              }`}
              style={{
                width: isDeclined
                  ? "50%"
                  : `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
              }}
            />

            {STEPS.map((step) => {
              const isCompleted = isDeclined
                ? step.id < 3
                : currentStep > step.id || (currentStep === 5 && step.id === 5);
              const isCurrent = isDeclined ? step.id === 3 : currentStep === step.id;

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-xs ${
                      isDeclined && isCurrent
                        ? "bg-red-600 text-white ring-4 ring-red-100"
                        : isCompleted
                        ? "bg-teal-700 text-white"
                        : isCurrent
                        ? "bg-white text-teal-700 border-2 border-teal-700 ring-4 ring-teal-50"
                        : "bg-white text-slate-400 border-2 border-slate-200"
                    }`}
                  >
                    {isDeclined && isCurrent ? (
                      "✕"
                    ) : isCompleted ? (
                      "✓"
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <div
                      className={`text-xs font-semibold ${
                        isCurrent ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] text-slate-400 hidden sm:block max-w-[90px]">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Informative Status Banner */}
      <div
        className={`rounded-xl p-4 text-xs ${
          isDeclined
            ? "bg-red-50 border border-red-200 text-red-800"
            : isAwaitingDocs
            ? "bg-amber-50 border border-amber-200 text-amber-800"
            : status === "agreement_generated"
            ? "bg-blue-50 border border-blue-200 text-blue-800"
            : status === "disbursed" || status === "performing"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-slate-50 border border-slate-200 text-slate-700"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-base leading-none">
            {isDeclined
              ? "⚠️"
              : isAwaitingDocs
              ? "📄"
              : status === "agreement_generated"
              ? "✍️"
              : status === "disbursed" || status === "performing"
              ? "✅"
              : "ℹ️"}
          </span>
          <div className="flex-1">
            <div className="font-semibold text-sm mb-0.5">
              {isDeclined
                ? "Your application was declined."
                : isAwaitingDocs
                ? "Additional documentation requested by loan officer."
                : status === "agreement_generated"
                ? "Your loan agreement is ready for digital signature."
                : status === "disbursed" || status === "performing"
                ? "Loan active and performing."
                : status === "under_review"
                ? "Loan officer is reviewing your paperwork."
                : status === "assessed"
                ? "Affordability calculation complete. Awaiting final branch approval."
                : "Application submitted and queued for review."}
            </div>
            <p className="leading-relaxed">
              {isDeclined
                ? "Unfortunately, this request did not satisfy our affordability policy criteria. You may contact your loan officer for further details."
                : isAwaitingDocs
                ? "Please see the Documents tab below to view which document requires re-upload."
                : status === "agreement_generated"
                ? "Review the loan agreement terms below and click 'Accept Loan Agreement' to finalize your disbursement."
                : status === "disbursed" || status === "performing"
                ? `Disbursement recorded. Your repayment is due on ${nextPayDate ?? "your scheduled pay date"}.`
                : status === "under_review"
                ? "Our team is reviewing your payslip, bank statement, and employment details. We will notify you once assessed."
                : "Thank you for applying with TMU CashLoan CC. Our team will review your application shortly."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
