'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";
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

export default function BorrowerPortalPage() {
  const [user, setUser] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [currentApp, setCurrentApp] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [latestDecision, setLatestDecision] = useState<any>(null);
  const [activeAgreement, setActiveAgreement] = useState<any>(null);
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [openArrears, setOpenArrears] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadPortalData() {
      try {
        const supabase = createClient();
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/portal/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!userData || userData.role !== 'borrower') {
          router.push('/portal/login');
          return;
        }

        setUser(userData);

        // Get applicant info
        if (userData.applicant_id) {
          const { data: applicantData } = await supabase
            .from('applicants')
            .select('*')
            .eq('id', userData.applicant_id)
            .single();

          setApplicant(applicantData);

          if (applicantData) {
            // Load applications
            const { data: applicationsData } = await supabase
              .from("applications")
              .select("*")
              .eq("applicant_id", applicantData.id)
              .order("created_at", { ascending: false });

            const applications = applicationsData || [];
            const currentApplication = applications[0] || null;
            setCurrentApp(currentApplication);

            if (currentApplication) {
              // Load related data in parallel
              const [
                { data: docsData },
                { data: decisionData },
                { data: agreementData },
                { data: loanData }
              ] = await Promise.all([
                supabase
                  .from("documents")
                  .select("*")
                  .eq("entity_type", "application")
                  .eq("entity_id", currentApplication.id)
                  .order("created_at", { ascending: false }),
                supabase
                  .from("decisions")
                  .select("*")
                  .eq("application_id", currentApplication.id)
                  .order("decided_at", { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from("agreements")
                  .select("*")
                  .eq("application_id", currentApplication.id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from("loans")
                  .select("*")
                  .eq("application_id", currentApplication.id)
                  .maybeSingle(),
              ]);

              setDocuments(docsData || []);
              setLatestDecision(decisionData);
              setActiveAgreement(agreementData);
              setActiveLoan(loanData);

              // Load loan-related data if exists
              if (loanData) {
                const [
                  { data: schedData },
                  { data: repData },
                  { data: arrearsData }
                ] = await Promise.all([
                  supabase
                    .from("schedules")
                    .select("*")
                    .eq("loan_id", loanData.id)
                    .order("instalment_number", { ascending: true }),
                  supabase
                    .from("repayments")
                    .select("*")
                    .eq("loan_id", loanData.id)
                    .order("paid_date", { ascending: false }),
                  supabase
                    .from("arrears_events")
                    .select("days_past_due, penalty_charged")
                    .eq("loan_id", loanData.id)
                    .eq("status", "open")
                    .order("days_past_due", { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                ]);

                setSchedules(schedData || []);
                setRepayments(repData || []);
                setOpenArrears(arrearsData);
              }
            }
          }
        }

      } catch (error) {
        console.error('Error loading portal data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!user || !applicant) {
    return null; // Will redirect to login
  }

  // State-based components
  
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
