'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [application, setApplication] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [employment, setEmployment] = useState<any>(null);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [incomeExpenditure, setIncomeExpenditure] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    async function getParams() {
      const resolvedParams = await params;
      setApplicationId(resolvedParams.id);
    }
    getParams();
  }, [params]);

  useEffect(() => {
    if (!applicationId) return;

    async function loadApplicationData() {
      try {
        const supabase = createClient();
        
        // Check authentication and get staff info
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!userData || userData.role === 'borrower') {
          router.push('/login');
          return;
        }

        setStaff(userData);

        // Load application data
        const { data: applicationData } = await supabase
          .from("applications")
          .select("*, applicants(*)")
          .eq("id", applicationId)
          .single();

        if (!applicationData) {
          router.push('/applications');
          return;
        }

        setApplication(applicationData);
        setApplicant(applicationData.applicants);

        // Load all related data in parallel
        const [
          { data: employmentData },
          { data: creditHistoryData },
          { data: bankDetailsData },
          { data: incomeExpenditureData },
          { data: documentsData },
          { data: consentsData },
          { data: assessmentsData },
          { data: decisionsData },
          { data: agreementsData },
          { data: loansData },
        ] = await Promise.all([
          supabase.from("employment").select("*").eq("application_id", applicationId).maybeSingle(),
          supabase.from("credit_history").select("*").eq("application_id", applicationId).order("created_at"),
          supabase.from("bank_details").select("*").eq("application_id", applicationId).maybeSingle(),
          supabase.from("income_expenditure").select("*").eq("application_id", applicationId),
          supabase.from("documents").select("*").eq("entity_type", "application").eq("entity_id", applicationId).order("created_at", { ascending: false }),
          supabase.from("consents").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }),
          supabase.from("assessments").select("*").eq("application_id", applicationId).order("created_at", { ascending: false }).limit(1),
          supabase.from("decisions").select("*").eq("application_id", applicationId).order("decided_at", { ascending: false }).limit(1),
          supabase.from("agreements").select("*").eq("application_id", applicationId).limit(1),
          supabase.from("loans").select("*").eq("application_id", applicationId).limit(1),
        ]);

        setEmployment(employmentData);
        setCreditHistory(creditHistoryData || []);
        setBankDetails(bankDetailsData);
        setIncomeExpenditure(incomeExpenditureData || []);
        setDocuments(documentsData || []);
        setConsents(consentsData || []);
        setAssessments(assessmentsData || []);
        setDecisions(decisionsData || []);
        setAgreements(agreementsData || []);
        setLoans(loansData || []);

        // Load loan-related data if loan exists
        const loan = loansData?.[0];
        if (loan) {
          const [{ data: schedulesData }, { data: repaymentsData }] = await Promise.all([
            supabase.from("schedules").select("*").eq("loan_id", loan.id).order("instalment_number"),
            supabase.from("repayments").select("*").eq("loan_id", loan.id),
          ]);

          setSchedules(schedulesData || []);
          setRepayments(repaymentsData || []);
        }

      } catch (error) {
        console.error('Error loading application data:', error);
        router.push('/applications');
      } finally {
        setLoading(false);
      }
    }

    loadApplicationData();
  }, [applicationId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!application || !applicant || !staff) {
    return null; // Will redirect
  }

  // Calculate derived values
  const assessment = assessments[0] ?? null;
  const decision = decisions[0] ?? null;
  const agreement = agreements[0] ?? null;
  const loan = loans[0] ?? null;
  
  const editable = ["draft", "submitted", "under_review", "awaiting_documents"].includes(application.status);
  const payslipDoc = documents.find((d) => d.doc_type === "payslip");
  const canRunAssessment = !!employment && incomeExpenditure.length > 0 && !!bankDetails;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">{application.reference_number}</h1>
          <p className="text-sm text-brand-muted">{applicant.full_name} · {formatNad(application.amount_requested)} · {application.term_months}mo</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={application.status} />
          <StatusActions applicationId={applicationId} status={application.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <EmploymentSection applicationId={applicationId} employment={employment} disabled={!editable} />
          <CreditHistorySection applicationId={applicationId} rows={creditHistory} disabled={!editable} />
          <BankDetailsSection applicationId={applicationId} bankDetails={bankDetails} disabled={!editable} />
          <IncomeExpenditureSection
            applicationId={applicationId}
            lines={incomeExpenditure}
            marriedInCop={applicant.marital_status === "married_in_cop"}
            disabled={!editable}
          />
          <DocumentsSection
            applicationId={applicationId}
            documents={documents}
            role={staff.role}
            payslipAvailable={!!payslipDoc}
          />
          <ConsentsSection applicantId={applicant.id} applicationId={applicationId} existing={consents} disabled={!editable} />
        </div>

        <div className="space-y-6">
          <AssessmentSection applicationId={applicationId} assessment={assessment} canRun={canRunAssessment && application.status !== "draft"} />
          <DecisionSection
            applicationId={applicationId}
            assessment={assessment}
            decision={decision}
            role={staff.role}
            requestedAmount={Number(application.amount_requested)}
            requestedTerm={application.term_months}
          />
          <AgreementSection applicationId={applicationId} decision={decision} agreement={agreement} role={staff.role} />
          <DisbursementSection
            applicationId={applicationId}
            agreement={agreement}
            decidedBy={decision?.decided_by ?? null}
            currentUserId={staff.id}
            role={staff.role}
            loan={loan}
          />
          <RepaymentSection applicationId={applicationId} loan={loan} schedules={schedules} repayments={repayments} role={staff.role} />
        </div>
      </div>
    </div>
  );
}
