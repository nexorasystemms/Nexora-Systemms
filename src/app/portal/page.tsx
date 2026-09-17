import Link from "next/link";
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

export const metadata = {
  title: "Dashboard — TMU CashLoan CC Borrower Portal",
};

export default async function BorrowerPortalPage() {
  const { user, applicant } = await requireBorrower();
  const admin = createAdminClient();

  if (!applicant) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-xs my-8">
        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4 text-xl">
          👋
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Welcome, {user.full_name}!
        </h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Your online account is active. We did not find an existing loan application linked to your profile yet.
          You can start an online application immediately or visit our branch in Windhoek.
        </p>
        <Link
          href="/portal/apply"
          className="inline-block mb-6 px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition"
        >
          Start Cash Loan Application →
        </Link>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-left">
          <div className="font-semibold text-slate-800 mb-1">Applying in person?</div>
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
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-xs my-8">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto mb-4 text-xl">
          📋
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Ready to Apply?</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Hello {applicant.full_name}, you currently have no active loan applications under review at TMU CashLoan CC.
        </p>
        <Link
          href="/portal/apply"
          className="inline-block px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition"
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

  if (loan) {
    const [{ data: schedData }, { data: repData }] = await Promise.all([
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
    ]);
    schedules = schedData ?? [];
    repayments = repData ?? [];
  }

  const documents: DocumentRow[] = docs ?? [];
  const latestDecision: DecisionRow | null = decision ?? null;
  const activeAgreement: AgreementRow | null = agreement ?? null;
  const activeLoan: LoanRow | null = loan ?? null;

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Welcome back, {applicant.full_name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Application Reference:{" "}
            <span className="font-mono font-semibold text-slate-700">
              {currentApp.reference_number}
            </span>{" "}
            · Submitted {new Date(currentApp.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(currentApp.status === "settled" || currentApp.status === "declined" || currentApp.status === "withdrawn") && (
            <Link
              href="/portal/apply"
              className="px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition"
            >
              + New Application
            </Link>
          )}
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
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
