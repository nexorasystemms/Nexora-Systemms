import { createClient } from "@/lib/supabase/server";
import { formatNad, formatDateTime } from "@/lib/format";

// FR-RPT-03 (portfolio summary) + FR-DEC-07 (override report). Both are Should-priority —
// the underlying queries exist and are checked during the pilot, per the SRS's own note that
// one month of data is too small a sample for a polished dashboard.
export default async function ReportsPage() {
  const supabase = await createClient();

  const [{ data: applications }, { data: loans }, { data: decisions }] = await Promise.all([
    supabase.from("applications").select("status, amount_requested, created_at"),
    supabase.from("loans").select("disbursed_amount, status"),
    supabase.from("decisions").select("outcome, is_override, reason_code, decided_by, decided_at").order("decided_at", { ascending: false }).limit(50),
  ]);

  const total = applications?.length ?? 0;
  const approved = applications?.filter((a) => ["approved", "approved_with_changes", "disbursed", "performing", "in_arrears", "settled", "handed_over"].includes(a.status)).length ?? 0;
  const declined = applications?.filter((a) => a.status === "declined").length ?? 0;
  const approvalRate = total > 0 ? (approved / total) * 100 : 0;
  const avgLoanSize = total > 0 ? (applications?.reduce((s, a) => s + Number(a.amount_requested), 0) ?? 0) / total : 0;
  const totalDisbursed = loans?.reduce((s, l) => s + Number(l.disbursed_amount), 0) ?? 0;
  const totalOutstanding = loans?.filter((l) => !["settled"].includes(l.status)).reduce((s, l) => s + Number(l.disbursed_amount), 0) ?? 0;

  const overrides = decisions?.filter((d) => d.is_override) ?? [];
  const overrideRate = (decisions?.length ?? 0) > 0 ? (overrides.length / (decisions?.length ?? 1)) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Reports</h1>
        <p className="text-sm text-brand-muted">Portfolio summary (FR-RPT-03) and override report (FR-DEC-07).</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Applications" value={String(total)} />
        <Stat label="Approval rate" value={`${approvalRate.toFixed(0)}%`} />
        <Stat label="Declined" value={String(declined)} />
        <Stat label="Avg loan size" value={formatNad(avgLoanSize)} />
        <Stat label="Total disbursed" value={formatNad(totalDisbursed)} />
        <Stat label="Total outstanding" value={formatNad(totalOutstanding)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-navy">Recent decisions & overrides</h2>
          <span className="text-xs text-brand-muted">Override rate (last {decisions?.length ?? 0}): {overrideRate.toFixed(0)}%</span>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Outcome</th>
                <th className="text-left px-4 py-3">Override?</th>
                <th className="text-left px-4 py-3">Reason code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {decisions?.map((d, i) => (
                <tr key={i} className={d.is_override ? "bg-amber-50" : ""}>
                  <td className="px-4 py-3 text-brand-muted">{formatDateTime(d.decided_at)}</td>
                  <td className="px-4 py-3 capitalize">{d.outcome.replace("_", " ")}</td>
                  <td className="px-4 py-3">{d.is_override ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{d.reason_code}</td>
                </tr>
              ))}
              {!decisions?.length && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-brand-muted">No decisions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
      <div className="text-xs text-brand-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-semibold text-brand-navy">{value}</div>
    </div>
  );
}
