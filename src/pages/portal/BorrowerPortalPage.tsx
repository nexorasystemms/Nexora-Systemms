import { useState, useEffect, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
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
  const navigate = useNavigate();

  useEffect(() => {
    async function loadPortalData() {
      try {
        const supabase = createClient();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate('/portal/login'); return; }

        const { data: userData } = await supabase
          .from('users').select('*').eq('id', session.user.id).single();

        if (!userData || userData.role !== 'borrower') { navigate('/portal/login'); return; }

        setUser(userData);

        if (userData.applicant_id) {
          const { data: applicantData } = await supabase
            .from('applicants').select('*').eq('id', userData.applicant_id).single();

          setApplicant(applicantData);

          if (applicantData) {
            const { data: applicationsData } = await supabase
              .from("applications").select("*")
              .eq("applicant_id", applicantData.id)
              .order("created_at", { ascending: false });

            const currentApplication = (applicationsData || [])[0] || null;
            setCurrentApp(currentApplication);

            if (currentApplication) {
              const [
                { data: docsData },
                { data: decisionData },
                { data: agreementData },
                { data: loanData }
              ] = await Promise.all([
                supabase.from("documents").select("*")
                  .eq("entity_type", "application").eq("entity_id", currentApplication.id)
                  .order("created_at", { ascending: false }),
                supabase.from("decisions").select("*")
                  .eq("application_id", currentApplication.id)
                  .order("decided_at", { ascending: false }).limit(1).maybeSingle(),
                supabase.from("agreements").select("*")
                  .eq("application_id", currentApplication.id)
                  .order("created_at", { ascending: false }).limit(1).maybeSingle(),
                supabase.from("loans").select("*")
                  .eq("application_id", currentApplication.id).maybeSingle(),
              ]);

              setDocuments(docsData || []);
              setLatestDecision(decisionData);
              setActiveAgreement(agreementData);
              setActiveLoan(loanData);

              if (loanData) {
                const [{ data: schedData }, { data: repData }, { data: arrearsData }] = await Promise.all([
                  supabase.from("schedules").select("*").eq("loan_id", loanData.id)
                    .order("instalment_number", { ascending: true }),
                  supabase.from("repayments").select("*").eq("loan_id", loanData.id)
                    .order("paid_date", { ascending: false }),
                  supabase.from("arrears_events").select("days_past_due, penalty_charged")
                    .eq("loan_id", loanData.id).eq("status", "open")
                    .order("days_past_due", { ascending: false }).limit(1).maybeSingle(),
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
  }, [navigate]);

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

  if (!user) return null;

  if (!applicant) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-8">
        <h2 className="text-xl font-bold text-on-surface mb-space-sm">Welcome, {user.full_name}!</h2>
        <p className="text-sm text-on-surface-variant mb-space-lg leading-relaxed">
          Your account is active. No application is linked yet — start one below or visit our branch.
        </p>
        <Link to="/portal/apply" className="inline-block mb-space-lg px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-bold text-[13px] shadow-sm hover:opacity-90 transition">
          Start Cash Loan Application →
        </Link>
      </div>
    );
  }

  if (!currentApp) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-8">
        <h2 className="text-xl font-bold text-on-surface mb-space-sm">Ready to Apply?</h2>
        <p className="text-sm text-on-surface-variant mb-space-lg leading-relaxed">
          Hello {applicant.full_name}, you have no active loan applications under review.
        </p>
        <Link to="/portal/apply" className="inline-block px-space-lg py-space-sm rounded-xl bg-primary text-on-primary font-bold text-[13px] shadow-sm hover:opacity-90 transition">
          Apply for a Cash Loan →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <WelcomeMessage />
      </Suspense>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary tracking-tight">
            Welcome back, {applicant.full_name}
          </h1>
          <p className="text-[12px] text-on-surface-variant mt-0.5 font-mono">
            Reference: <span className="font-semibold text-on-surface">{currentApp.reference_number}</span>
            {" "}· Submitted {new Date(currentApp.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          {["settled", "declined", "withdrawn"].includes(currentApp.status) && (
            <Link to="/portal/apply" className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold shadow-sm hover:opacity-90 transition">
              + New Application
            </Link>
          )}
          <span className="px-space-md py-1.5 rounded-full text-[12px] font-semibold bg-primary-container text-on-primary shadow-sm">
            Term: {currentApp.term_months} {currentApp.term_months === 1 ? "month" : "months"} ({currentApp.product_type === "once_off" ? "Once-off Payday" : "Monthly Instalments"})
          </span>
        </div>
      </div>

      <StageTracker
        status={currentApp.status}
        nextPayDate={currentApp.next_pay_date}
        amountRequested={Number(currentApp.amount_requested)}
        approvedAmount={latestDecision?.amount_approved}
        declineReasonCode={latestDecision?.reason_code}
        arrearsDaysPastDue={openArrears?.days_past_due}
        arrearsPenalty={openArrears?.penalty_charged}
      />

      {activeLoan && (
        <RepaymentScheduleCard loan={activeLoan} schedules={schedules} repayments={repayments} />
      )}

      {(activeAgreement || ["approved", "agreement_generated", "agreement_accepted"].includes(currentApp.status)) && (
        <AgreementCard applicationId={currentApp.id} status={currentApp.status} agreement={activeAgreement} />
      )}

      <BorrowerDocumentsCard
        applicationId={currentApp.id}
        documents={documents}
        canUpload={["draft", "submitted", "under_review", "awaiting_documents"].includes(currentApp.status)}
      />
    </div>
  );
}
