"use client";

import type { ApplicationStatus } from "@/types/database";

interface StageTrackerProps {
  status: ApplicationStatus;
  nextPayDate: string | null;
  amountRequested: number;
  approvedAmount?: number | null;
  declineReasonCode?: string | null;
  arrearsDaysPastDue?: number | null;
  arrearsPenalty?: number | null;
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

function money(n: number) {
  return `N$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function StageTracker({
  status, nextPayDate, amountRequested, approvedAmount, declineReasonCode, arrearsDaysPastDue, arrearsPenalty,
}: StageTrackerProps) {
  const isDeclined = status === "declined";
  const isAwaitingDocs = status === "awaiting_documents";
  const isSettled = status === "settled";
  const isInArrears = status === "in_arrears";
  const isHandedOver = status === "handed_over";
  const isCounterOffer = status === "approved_with_changes" && approvedAmount != null && approvedAmount !== amountRequested;

  let currentStep = 1;
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
    default:
      currentStep = 5; // agreement_accepted, disbursed, performing, in_arrears, settled, handed_over
  }

  const headline = isDeclined
    ? "Application Decision: Declined"
    : isSettled
    ? "Loan Completed & Settled"
    : isHandedOver
    ? "Account Handed Over for Collection"
    : isInArrears
    ? "Account In Arrears — Action Needed"
    : isAwaitingDocs
    ? "Action Required: Additional Documents"
    : isCounterOffer
    ? "Counter-Offer: Different Terms Approved"
    : status === "agreement_generated"
    ? "Action Required: Sign Loan Agreement"
    : status === "disbursed" || status === "performing"
    ? "Active Loan — Performing"
    : `Stage ${currentStep} of 5: ${STEPS[currentStep - 1]?.label}`;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md border-b border-outline-variant/30 gap-space-sm">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Current Application Progress</span>
          <h2 className="text-lg font-bold text-on-surface mt-0.5">{headline}</h2>
        </div>

        <div className="flex items-center gap-space-sm">
          <span className="text-[12px] text-on-surface-variant">Requested:</span>
          <span className="text-sm font-bold text-on-surface font-mono">{money(amountRequested)}</span>
          {approvedAmount != null && approvedAmount !== amountRequested && (
            <span className="text-[11px] px-space-sm py-0.5 bg-secondary-container text-on-secondary-container rounded-full font-semibold">
              Approved: {money(approvedAmount)}
            </span>
          )}
        </div>
      </div>

      <div className="py-space-lg overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-surface-container -z-0" />
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 -z-0 transition-all duration-500 ${isDeclined ? "bg-error/40" : "bg-primary"}`}
              style={{ width: isDeclined ? "50%" : `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step) => {
              const isCompleted = isDeclined ? step.id < 3 : currentStep > step.id || (currentStep === 5 && step.id === 5);
              const isCurrent = isDeclined ? step.id === 3 : currentStep === step.id;
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                      isDeclined && isCurrent
                        ? "bg-error text-on-error"
                        : isCompleted
                        ? "bg-primary-container text-on-primary"
                        : isCurrent
                        ? "bg-surface-container-lowest text-primary border-2 border-primary"
                        : "bg-surface-container-lowest text-outline border-2 border-outline-variant"
                    }`}
                  >
                    {isDeclined && isCurrent ? (
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    ) : isCompleted ? (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <div className={`text-[12px] font-semibold ${isCurrent ? "text-on-surface" : "text-on-surface-variant"}`}>{step.label}</div>
                    <div className="text-[10px] text-outline hidden sm:block max-w-[90px]">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`rounded-xl p-space-md text-[12px] ${
        isDeclined || isHandedOver
          ? "bg-error-container text-on-error-container"
          : isInArrears
          ? "bg-error-container/60 text-on-error-container"
          : isAwaitingDocs || isCounterOffer
          ? "bg-secondary-container/50 text-on-secondary-container"
          : status === "agreement_generated"
          ? "bg-secondary-container/50 text-on-secondary-container"
          : status === "disbursed" || status === "performing" || isSettled
          ? "bg-tertiary-fixed/30 text-tertiary-container"
          : "bg-surface-container-low text-on-surface"
      }`}
      >
        <div className="flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-[18px] shrink-0">
            {isDeclined ? "error" : isHandedOver ? "gavel" : isInArrears ? "warning" : isAwaitingDocs ? "description" : isCounterOffer ? "handshake" :
              status === "agreement_generated" ? "draw" : status === "disbursed" || status === "performing" ? "check_circle" : isSettled ? "celebration" : "info"}
          </span>
          <div className="flex-1">
            <div className="font-semibold text-sm mb-0.5">
              {isDeclined
                ? "Your application was declined."
                : isHandedOver
                ? "This account has been handed over for collection."
                : isInArrears
                ? `Your account is ${arrearsDaysPastDue ?? "several"} day(s) past due.`
                : isAwaitingDocs
                ? "Additional documentation requested by loan officer."
                : isCounterOffer
                ? "We could not approve the full amount requested."
                : status === "agreement_generated"
                ? "Your loan agreement is ready for digital signature."
                : status === "disbursed" || status === "performing"
                ? "Loan active and performing."
                : isSettled
                ? "This loan has been fully repaid."
                : status === "under_review"
                ? "Loan officer is reviewing your paperwork."
                : status === "assessed"
                ? "Affordability calculation complete. Awaiting final branch approval."
                : "Application submitted and queued for review."}
            </div>
            <p className="leading-relaxed">
              {isDeclined
                ? `Reason: ${declineReasonCode?.replaceAll("_", " ") ?? "did not meet affordability criteria"}. You may contact your loan officer for details, or reapply once your circumstances change.`
                : isHandedOver
                ? "Please contact TMU CashLoan CC directly to arrange settlement and avoid further collection action."
                : isInArrears
                ? `A default charge of ${arrearsPenalty != null ? money(arrearsPenalty) : "a penalty"} has accrued. Please make a payment as soon as possible — go to Repayment Schedule below for the amount due.`
                : isAwaitingDocs
                ? "Please see the Documents section below to view which document requires re-upload."
                : isCounterOffer
                ? "Review the approved amount and term below — accepting the agreement means accepting these adjusted terms, not your original request."
                : status === "agreement_generated"
                ? "Review the loan agreement terms below and accept it to proceed to disbursement."
                : status === "disbursed" || status === "performing"
                ? `Disbursement recorded. Your repayment is due on ${nextPayDate ?? "your scheduled pay date"}.`
                : isSettled
                ? "Thank you for banking with TMU CashLoan CC. You're welcome to apply again any time."
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
