import Link from "next/link";
import { requireStaff } from "@/lib/current-staff";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import { formatNad, ageInDays } from "@/lib/format";

// FR-RPT-01: pipeline/operations view — every application by status, with age-in-status.
export default async function PipelinePage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, reference_number, amount_requested, status, created_at, updated_at, applicants(full_name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  const openCount = applications?.filter((a) => !["settled", "declined", "withdrawn", "handed_over"].includes(a.status)).length ?? 0;
  const inArrearsCount = applications?.filter((a) => a.status === "in_arrears").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">Application Pipeline</h1>
          <p className="text-sm text-brand-muted">Welcome back, {staff.full_name.split(" ")[0]}.</p>
        </div>
        <Link
          href="/applications/new"
          className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition"
        >
          + New Application
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Open applications" value={String(openCount)} />
        <SummaryCard label="In arrears" value={String(inArrearsCount)} tone={inArrearsCount > 0 ? "danger" : "default"} />
        <SummaryCard label="Total (last 100)" value={String(applications?.length ?? 0)} />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Reference</th>
              <th className="text-left px-4 py-3">Applicant</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Age in status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {applications?.map((app) => (
              <tr key={app.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <Link href={`/applications/${app.id}`} className="text-brand-blue font-medium hover:underline">
                    {app.reference_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{(app.applicants as unknown as { full_name: string } | null)?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{formatNad(app.amount_requested)}</td>
                <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                <td className="px-4 py-3 text-brand-muted">{ageInDays(app.updated_at)}d</td>
              </tr>
            ))}
            {!applications?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-brand-muted">
                  No applications yet. Create the first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
      <div className="text-xs text-brand-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${tone === "danger" ? "text-danger" : "text-brand-navy"}`}>{value}</div>
    </div>
  );
}
