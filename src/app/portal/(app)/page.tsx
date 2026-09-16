import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBorrower } from "@/lib/current-borrower";
import { formatDate, formatNad } from "@/lib/format";
import { PORTAL_STAGES, portalStageIndex, isTerminalApplication } from "@/lib/portal";
import type { ApplicationStatus } from "@/types/database";

export default async function PortalDashboardPage() {
  const applicant = await requireBorrower();
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Welcome, {applicant.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-brand-muted">Track your cash loan application here.</p>
      </div>

      {!application && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-brand-muted">You don&apos;t have an application yet.</p>
          <Link
            href="/portal/apply"
            className="inline-block rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition"
          >
            Start Cash Loan Application →
          </Link>
        </div>
      )}

      {application && application.status === "draft" && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-brand-muted">You have an application in progress.</p>
          <Link
            href="/portal/apply"
            className="inline-block rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition"
          >
            Continue application →
          </Link>
        </div>
      )}

      {application && application.status !== "draft" && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-brand-muted">Reference</p>
              <p className="font-mono text-sm">{application.reference_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-muted">Requested</p>
              <p className="text-sm font-medium">{formatNad(application.amount_requested)} · {application.term_months}mo</p>
            </div>
          </div>

          <StageTracker status={application.status} />

          <p className="text-xs text-brand-muted">Submitted {formatDate(application.created_at)}</p>

          {isTerminalApplication(application.status) && (
            <Link
              href="/portal/apply"
              className="inline-block rounded-md border border-brand-navy text-brand-navy text-sm font-medium px-5 py-2.5 hover:bg-brand-navy hover:text-white transition"
            >
              + New application
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StageTracker({ status }: { status: ApplicationStatus }) {
  const currentIndex = portalStageIndex(status);
  const declined = status === "declined";

  return (
    <div className="flex items-center">
      {PORTAL_STAGES.map((stage, i) => {
        const reached = currentIndex != null && i <= currentIndex;
        const isCurrent = currentIndex === i;
        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  declined && isCurrent
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : reached
                      ? "bg-brand-navy text-white"
                      : "bg-gray-100 text-gray-400 border border-brand-border"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-[11px] text-center ${reached ? "text-brand-navy font-medium" : "text-brand-muted"}`}>
                {declined && isCurrent ? "Declined" : stage.label}
              </span>
            </div>
            {i < PORTAL_STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${currentIndex != null && i < currentIndex ? "bg-brand-navy" : "bg-brand-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
