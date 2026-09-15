import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/current-staff";
import StatusBadge from "@/components/StatusBadge";
import { formatNad } from "@/lib/format";
import {
  EmploymentSection, CreditHistorySection, BankDetailsSection, IncomeExpenditureSection,
  ConsentsSection, StatusActions,
} from "./IntakeSections";
import DocumentsSection from "./DocumentsSection";
import {
  AssessmentSection, DecisionSection, AgreementSection, DisbursementSection, RepaymentSection,
} from "./DecisionFlow";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: application } = await supabase.from("applications").select("*, applicants(*)").eq("id", id).single();
  if (!application) notFound();

  const applicant = application.applicants as unknown as {
    id: string; full_name: string; marital_status: string;
  };

  const [
    { data: employment }, { data: creditHistory }, { data: bankDetails }, { data: incomeExpenditure },
    { data: documents }, { data: consents }, { data: assessments }, { data: decisions },
    { data: agreements }, { data: loans },
  ] = await Promise.all([
    supabase.from("employment").select("*").eq("application_id", id).maybeSingle(),
    supabase.from("credit_history").select("*").eq("application_id", id).order("created_at"),
    supabase.from("bank_details").select("*").eq("application_id", id).maybeSingle(),
    supabase.from("income_expenditure").select("*").eq("application_id", id),
    supabase.from("documents").select("*").eq("entity_type", "application").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("consents").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("assessments").select("*").eq("application_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("decisions").select("*").eq("application_id", id).order("decided_at", { ascending: false }).limit(1),
    supabase.from("agreements").select("*").eq("application_id", id).limit(1),
    supabase.from("loans").select("*").eq("application_id", id).limit(1),
  ]);

  const assessment = assessments?.[0] ?? null;
  const decision = decisions?.[0] ?? null;
  const agreement = agreements?.[0] ?? null;
  const loan = loans?.[0] ?? null;

  const { data: schedules } = loan
    ? await supabase.from("schedules").select("*").eq("loan_id", loan.id).order("instalment_number")
    : { data: [] };
  const { data: repayments } = loan
    ? await supabase.from("repayments").select("*").eq("loan_id", loan.id)
    : { data: [] };

  const editable = ["draft", "submitted", "under_review", "awaiting_documents"].includes(application.status);
  const payslipDoc = documents?.find((d) => d.doc_type === "payslip");
  const canRunAssessment = !!employment && (incomeExpenditure?.length ?? 0) > 0 && !!bankDetails;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">{application.reference_number}</h1>
          <p className="text-sm text-brand-muted">{applicant.full_name} · {formatNad(application.amount_requested)} · {application.term_months}mo</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={application.status} />
          <StatusActions applicationId={id} status={application.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EmploymentSection applicationId={id} employment={employment} disabled={!editable} />
          <CreditHistorySection applicationId={id} rows={creditHistory ?? []} disabled={!editable} />
          <BankDetailsSection applicationId={id} bankDetails={bankDetails} disabled={!editable} />
          <IncomeExpenditureSection
            applicationId={id}
            lines={incomeExpenditure ?? []}
            marriedInCop={applicant.marital_status === "married_in_cop"}
            disabled={!editable}
          />
          <DocumentsSection
            applicationId={id}
            documents={documents ?? []}
            role={staff.role}
            payslipAvailable={!!payslipDoc}
          />
          <ConsentsSection applicantId={applicant.id} applicationId={id} existing={consents ?? []} disabled={!editable} />
        </div>

        <div className="space-y-6">
          <AssessmentSection applicationId={id} assessment={assessment} canRun={canRunAssessment && application.status !== "draft"} />
          <DecisionSection
            applicationId={id}
            assessment={assessment}
            decision={decision}
            role={staff.role}
            requestedAmount={Number(application.amount_requested)}
            requestedTerm={application.term_months}
          />
          <AgreementSection applicationId={id} decision={decision} agreement={agreement} role={staff.role} />
          <DisbursementSection
            applicationId={id}
            agreement={agreement}
            decidedBy={decision?.decided_by ?? null}
            currentUserId={staff.id}
            role={staff.role}
            loan={loan}
          />
          <RepaymentSection applicationId={id} loan={loan} schedules={schedules ?? []} repayments={repayments ?? []} role={staff.role} />
        </div>
      </div>
    </div>
  );
}
