import Link from "next/link";
import { Suspense } from "react";
import { requireBorrower } from "@/lib/current-borrower";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ApplicationRow,
  DocumentRow,
  AgreementRow,
  LoanRow,
  ScheduleRow,
  RepaymentRow,
  DecisionRow,
} from "@/types/database";
import StageTracker from "./StageTracker";
import BorrowerDocumentsCard from "./BorrowerDocumentsCard";
import AgreementCard from "./AgreementCard";
import RepaymentScheduleCard from "./RepaymentScheduleCard";
import WelcomeMessage from "./WelcomeMessage";

export const metadata = {
  title: "Dashboard — TMU CashLoan CC Borrower Portal",
};

export default async function BorrowerPortalPage() {
  const { user, applicant } = await requireBorrower();
  const admin = createAdminClient();

  if (!applicant) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-8">
        <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-space-md">
          <span className="material-symbols-outlined text-[24px]">waving_hand</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-space-sm">Welcome, {user.full_name}!</h2>
        <p className="text-sm text-on-surface-variant mb-space-lg leading-relaxed">
          Your online account is active. We did not find an existing loan application linked to your profile yet.
          You can start an online application immediately or visit our branch in Windhoek.
        </p>
        <Link
          href="/portal/apply"
          className="inline-block mb-space-lg px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-bold text-[13px] shadow-sm hover:opacity-90 transition"
        >
          Start Cash Loan Application →
        </Link>
        <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/30 text-[12px] text-on-surface-variant text-left">
          <div className="font-semibold text-on-surface mb-1">Applying in person?</div>
          Visit TMU CashLoan CC at Independence Avenue, Windhoek with your Namibian ID, latest payslip, and 3-month bank statement.
        </div>
      </div>
    );
  }

  // Fetch applications for this applicant
  const { data: applications } = await admin
    .from("applications")
    .select("*")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false });

  const currentApp: ApplicationRow | null = applications?.[0] ?? null;

  if (!currentApp) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-8">
        <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-space-md">
          <span className="material-symbols-outlined text-[24px]">assignment</span>
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-space-sm">Ready to Apply?</h2>
        <p className="text-sm text-on-surface-variant mb-space-lg leading-relaxed">
          Hello {applicant.full_name}, you currently have no active loan applications under review at TMU CashLoan CC.
        </p>
        <Link
          href="/portal/apply"
          className="inline-block px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-bold text-[13px] shadow-sm hover:opacity-90 transition"
        >
          Apply for a Cash Loan →
        </Link>
      </div>
    );
  }

  // Fetch related records in parallel
  const [{ data: docs }, { data: decision }, { data: agreement }, { data: loan }] =
    await Promise.all([
      admin
        .from("documents")
        .select("*")
        .eq("entity_type", "application")
        .eq("entity_id", currentApp.id)
        .order("created_at", { ascending: false }),
      admin
        .from("decisions")
        .select("*")
        .eq("application_id", currentApp.id)
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("agreements")
        .select("*")
        .eq("application_id", currentApp.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("loans")
        .select("*")
        .eq("application_id", currentApp.id)
        .maybeSingle(),
    ]);

  let schedules: ScheduleRow[] = [];
  let repayments: RepaymentRow[] = [];
  let openArrears: { days_past_due: number; penalty_charged: number } | null = null;

  if (loan) {
    const [{ data: schedData }, { data: repData }, { data: arrearsData }] = await Promise.all([
      admin
        .from("schedules")
        .select("*")
        .eq("loan_id", loan.id)
        .order("instalment_number", { ascending: true }),
      admin
        .from("repayments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("paid_date", { ascending: false }),
      admin
        .from("arrears_events")
        .select("days_past_due, penalty_charged")
        .eq("loan_id", loan.id)
        .eq("status", "open")
        .order("days_past_due", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    schedules = schedData ?? [];
    repayments = repData ?? [];
    openArrears = arrearsData ?? null;
  }

  const documents: DocumentRow[] = docs ?? [];
  const latestDecision: DecisionRow | null = decision ?? null;
  const activeAgreement: AgreementRow | null = agreement ?? null;
  const activeLoan: LoanRow | null = loan ?? null;

  return (
    <div className="space-y-6">
      {/* Welcome Message (if any) */}
      <Suspense fallback={null}>
        <WelcomeMessage />
      </Suspense>
      
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary tracking-tight">
            Welcome back, {applicant.full_name}
          </h1>
          <p className="text-[12px] text-on-surface-variant mt-0.5 font-mono">
            Application Reference: <span className="font-semibold text-on-surface">{currentApp.reference_number}</span>
            {" "}· Submitted {new Date(currentApp.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-space-sm">
          {(currentApp.status === "settled" || currentApp.status === "declined" || currentApp.status === "withdrawn") && (
            <Link
              href="/portal/apply"
              className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold shadow-sm hover:opacity-90 transition"
            >
              + New Application
            </Link>
          )}
          <span className="px-space-md py-1.5 rounded-full text-[12px] font-semibold bg-primary-container text-on-primary shadow-sm">
            Term: {currentApp.term_months} {currentApp.term_months === 1 ? "month" : "months"} (
            {currentApp.product_type === "once_off" ? "Once-off Payday" : "Monthly Instalments"})
          </span>
        </div>
      </div>

      {/* 1. The Stage Progress Stepper */}
      <StageTracker
        status={currentApp.status}
        nextPayDate={currentApp.next_pay_date}
        amountRequested={Number(currentApp.amount_requested)}
        approvedAmount={latestDecision?.amount_approved}
        declineReasonCode={latestDecision?.reason_code}
        arrearsDaysPastDue={openArrears?.days_past_due}
        arrearsPenalty={openArrears?.penalty_charged}
      />

      {/* 2. Active Loan Repayment Card (If Disbursed / Performing / In Arrears) */}
      {activeLoan && (
        <RepaymentScheduleCard
          loan={activeLoan}
          schedules={schedules}
          repayments={repayments}
        />
      )}

      {/* 3. Loan Agreement & Terms Review Card */}
      {(activeAgreement ||
        currentApp.status === "approved" ||
        currentApp.status === "agreement_generated" ||
        currentApp.status === "agreement_accepted") && (
        <AgreementCard
          applicationId={currentApp.id}
          status={currentApp.status}
          agreement={activeAgreement}
        />
      )}

      {/* 4. Application Verification Documents & Uploads */}
      <BorrowerDocumentsCard
        applicationId={currentApp.id}
        documents={documents}
        canUpload={
          currentApp.status === "draft" ||
          currentApp.status === "submitted" ||
          currentApp.status === "under_review" ||
          currentApp.status === "awaiting_documents"
        }
      />
    </div>
  );
}
