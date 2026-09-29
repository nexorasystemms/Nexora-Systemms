import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
import { formatNad, formatDate } from "../../lib/format";
import type { RuleResult } from "../../lib/rules-engine/types";
import type { ApplicationStatus } from "../../types/database";

const STAGES: { key: ApplicationStatus[]; label: string }[] = [
  { key: ["draft"],                                      label: "Draft" },
  { key: ["submitted"],                                  label: "Submitted" },
  { key: ["under_review", "awaiting_documents"],         label: "Review" },
  { key: ["assessed"],                                   label: "Assessed" },
  { key: ["approved", "approved_with_changes"],          label: "Approved" },
  { key: ["agreement_generated", "agreement_accepted"],  label: "Agreement" },
  { key: ["disbursed", "performing", "in_arrears"],      label: "Disbursed" },
];

function ruleStatusBadge(rulesPassed: RuleResult[] | null, rulesFailed: RuleResult[] | null) {
  if (!rulesPassed && !rulesFailed)
    return { label: "Not Assessed", tone: "bg-surface-container text-on-surface-variant", icon: "hourglass_empty" };
  const failed = rulesFailed ?? [];
  const total  = (rulesPassed?.length ?? 0) + failed.length;
  const hasReg = failed.some((r) => r.type === "Regulatory");
  if (hasReg)          return { label: "Hard Blocked",   tone: "bg-error-container text-on-error-container font-bold", icon: "block" };
  if (failed.length)   return { label: "Policy Flagged", tone: "bg-secondary-container text-on-secondary-container",  icon: "info" };
  return { label: `Passed ${total}/${total}`, tone: "bg-tertiary-fixed/40 text-tertiary-container", icon: "check_circle" };
}

export default function DashboardPage() {
  const [staff,       setStaff]       = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [assessments,  setAssessments]  = useState<any[]>([]);
  const [loans,        setLoans]        = useState<any[]>([]);
  const [arrearsEvents, setArrearsEvents] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }

        const { data: userData } = await supabase
          .from("users").select("*").eq("id", session.user.id).single();
        if (!userData || userData.role === "borrower") { navigate("/login"); return; }
        setStaff(userData);

        const { data: appsData } = await supabase
          .from("applications")
          .select("id, reference_number, amount_requested, term_months, product_type, next_pay_date, status, created_at, updated_at, applicants(full_name, id_type), users(full_name)")
          .order("updated_at", { ascending: false })
          .limit(100);
        setApplications(appsData || []);

        if (appsData?.length) {
          const appIds = appsData.map((a) => a.id);
          const { data: assessmentsData } = await supabase
            .from("assessments")
            .select("application_id, computed_s, computed_dsr, rules_passed, rules_failed, created_at")
            .in("application_id", appIds)
            .order("created_at", { ascending: false });
          setAssessments(assessmentsData || []);
        }

        const { data: loansData } = await supabase.from("loans").select("disbursed_amount, status");
        const { data: arrearsData } = await supabase
          .from("arrears_events").select("penalty_charged, status").eq("status", "open");
        setLoans(loansData || []);
        setArrearsEvents(arrearsData || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-on-surface-variant">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  if (!staff) return null;

  const latestAssessmentByApp = new Map<string, any>();
  for (const a of assessments) {
    if (!latestAssessmentByApp.has(a.application_id))
      latestAssessmentByApp.set(a.application_id, a);
  }

  const activeApps     = applications.filter((a) => !["settled","declined","withdrawn","handed_over"].includes(a.status));
  const activeVolume   = activeApps.reduce((s, a) => s + Number(a.amount_requested), 0);
  const disbursedLoans = loans.filter((l) => l.status !== "handed_over");
  const disbursedVol   = disbursedLoans.reduce((s, l) => s + Number(l.disbursed_amount), 0);
  const awaitingDec    = applications.filter((a) => a.status === "assessed").length;
  const arrearsAtRisk  = arrearsEvents.reduce((s, e) => s + Number(e.penalty_charged), 0);

  return (
    <div className="space-y-space-lg">

      {/* ── Welcome banner ── */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-primary uppercase tracking-widest font-semibold">Nexora Cash Loan Module</span>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            Welcome back, {staff.full_name.split(" ")[0]}
          </h1>
          <p className="text-sm text-on-surface-variant">Live application pipeline.</p>
        </div>
        <Link
          to="/dashboard/applicants"
          className="self-start lg:self-auto inline-flex items-center gap-1.5 px-4 h-10 rounded bg-primary-container text-on-primary text-sm font-semibold hover:bg-primary transition-colors shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          New Intake Dossier
        </Link>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-gutter-desktop">
        <KpiCard label="Active Pipeline"    icon="account_tree" value={String(activeApps.length)}      unit="Applications" sub={`Vol: ${formatNad(activeVolume)}`} />
        <KpiCard label="Awaiting Decision"  icon="gavel"        value={String(awaitingDec)}            unit="Assessed"     sub="Ready for review" />
        <KpiCard label="Disbursed"          icon="payments"     value={String(disbursedLoans.length)}  unit="Loans"        sub={`Capital: ${formatNad(disbursedVol)}`} tone="tertiary" />
        <KpiCard label="Arrears Watchlist"  icon="warning"      value={String(arrearsEvents.length)}   unit="Open Cases"   sub={`${formatNad(arrearsAtRisk)} penalty`} tone="error" />
      </div>

      {/* ── Origination lifecycle ── */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm space-y-3">
        <h2 className="text-base sm:text-lg font-bold text-on-surface">Origination Lifecycle</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STAGES.map((stage) => {
            const inStage = applications.filter((a) => stage.key.includes(a.status));
            const sum     = inStage.reduce((s, a) => s + Number(a.amount_requested), 0);
            return (
              <div key={stage.label} className="bg-surface-container-low rounded-lg p-2 sm:p-space-sm flex flex-col justify-between min-h-[76px] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] text-secondary uppercase font-semibold leading-none">{stage.label}</span>
                  <span className="w-5 h-5 rounded-full bg-surface-container-highest text-primary font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                    {inStage.length}
                  </span>
                </div>
                <div className="font-mono text-[13px] sm:text-base text-on-surface font-bold mt-1">{formatNad(sum)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Queue ledger ── */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-space-lg flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface">Queue Ledger</h2>
            <p className="text-xs sm:text-sm text-on-surface-variant">Live surplus & rule-engine status from latest assessment.</p>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[11px] font-semibold">
            {applications.length} REC
          </span>
        </div>

        {/* ─── Mobile card list (< md) ─── */}
        <div className="md:hidden divide-y divide-surface-container-low">
          {applications.map((app) => {
            const assessment = latestAssessmentByApp.get(app.id);
            const rules      = ruleStatusBadge(
              (assessment?.rules_passed as RuleResult[] | null) ?? null,
              (assessment?.rules_failed as RuleResult[] | null) ?? null,
            );
            const applicant  = app.applicants as unknown as { full_name: string } | null;
            const surplus    = assessment ? Number(assessment.computed_s) : null;
            return (
              <div key={app.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[13px] text-primary font-bold">{app.reference_number}</div>
                    <div className="text-sm text-on-surface">{applicant?.full_name ?? "—"}</div>
                  </div>
                  <Link
                    to={`/dashboard/applications/${app.id}`}
                    className="shrink-0 px-3 py-1.5 rounded bg-primary-container text-on-primary text-xs font-medium hover:bg-primary shadow-sm"
                  >
                    Open
                  </Link>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-on-surface-variant">
                  <span><span className="font-medium text-on-surface">{formatNad(app.amount_requested)}</span> requested</span>
                  {surplus != null && (
                    <span>
                      S:{" "}
                      <span className={`font-medium ${surplus > 0 ? "text-tertiary-container" : "text-error"}`}>
                        {surplus > 0 ? "+" : ""}{formatNad(surplus)}
                      </span>
                    </span>
                  )}
                  {assessment && (
                    <span>DSR: <span className="font-medium text-on-surface">{(Number(assessment.computed_dsr) * 100).toFixed(1)}%</span></span>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${rules.tone}`}>
                  <span className="material-symbols-outlined text-[12px]">{rules.icon}</span>
                  {rules.label}
                </span>
              </div>
            );
          })}
          {!applications.length && (
            <div className="px-4 py-10 text-center text-on-surface-variant text-sm">
              No applications yet. Create the first one from &ldquo;New Intake Dossier&rdquo; above.
            </div>
          )}
        </div>

        {/* ─── Desktop table (≥ md) ─── */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider h-9">
                <th className="px-4 py-1 font-semibold">App Ref &amp; Borrower</th>
                <th className="px-4 py-1 text-right font-semibold">Requested</th>
                <th className="px-4 py-1 font-semibold hidden lg:table-cell">Next Pay Date</th>
                <th className="px-4 py-1 text-right font-semibold">Surplus</th>
                <th className="px-4 py-1 text-center font-semibold hidden lg:table-cell">DSR</th>
                <th className="px-4 py-1 font-semibold">Rules</th>
                <th className="px-4 py-1 font-semibold hidden xl:table-cell">Created By</th>
                <th className="px-4 py-1 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low text-sm text-on-surface">
              {applications.map((app) => {
                const assessment = latestAssessmentByApp.get(app.id);
                const rules      = ruleStatusBadge(
                  (assessment?.rules_passed as RuleResult[] | null) ?? null,
                  (assessment?.rules_failed as RuleResult[] | null) ?? null,
                );
                const applicant  = app.applicants as unknown as { full_name: string } | null;
                const createdBy  = app.users     as unknown as { full_name: string } | null;
                const surplus    = assessment ? Number(assessment.computed_s) : null;
                return (
                  <tr key={app.id} className="hover:bg-surface-container-low transition-colors h-12">
                    <td className="px-4 py-2">
                      <div className="font-mono text-[13px] text-primary font-bold">{app.reference_number}</div>
                      <div className="text-sm text-on-surface">{applicant?.full_name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold whitespace-nowrap">
                      {formatNad(app.amount_requested)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[12px] text-secondary hidden lg:table-cell whitespace-nowrap">
                      {app.next_pay_date ? formatDate(app.next_pay_date) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold whitespace-nowrap">
                      {surplus == null
                        ? <span className="text-on-surface-variant">—</span>
                        : <span className={surplus > 0 ? "text-tertiary-container" : "text-error"}>
                            {surplus > 0 ? "+" : ""}{formatNad(surplus)}
                          </span>
                      }
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-[12px] hidden lg:table-cell">
                      {assessment ? `${(Number(assessment.computed_dsr) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${rules.tone}`}>
                        <span className="material-symbols-outlined text-[12px]">{rules.icon}</span>
                        {rules.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-on-surface-variant hidden xl:table-cell">
                      {createdBy?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/dashboard/applications/${app.id}`}
                        className="px-2 py-1 rounded bg-primary-container text-on-primary text-[12px] font-medium hover:bg-primary shadow-sm whitespace-nowrap"
                      >
                        Open File
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!applications.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant">
                    No applications yet. Create the first one from &ldquo;New Intake Dossier&rdquo; above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, icon, value, unit, sub, tone = "primary",
}: { label: string; icon: string; value: string; unit: string; sub: string; tone?: "primary" | "tertiary" | "error" }) {
  const valueColor = tone === "tertiary" ? "text-tertiary-container" : tone === "error" ? "text-error" : "text-on-surface";
  const iconColor  = tone === "tertiary" ? "text-tertiary-container" : tone === "error" ? "text-error" : "text-primary";
  return (
    <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-[11px] uppercase text-on-surface-variant tracking-wider font-semibold leading-tight">{label}</span>
        <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${iconColor}`}>{icon}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`text-2xl sm:text-3xl font-mono font-bold ${valueColor}`}>{value}</span>
          <span className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase">{unit}</span>
        </div>
        <div className="mt-1 text-[11px] font-mono text-on-surface-variant truncate">{sub}</div>
      </div>
    </div>
  );
}
