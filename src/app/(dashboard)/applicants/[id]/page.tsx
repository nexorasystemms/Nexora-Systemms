import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import { formatNad, formatDate } from "@/lib/format";

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: applicant } = await supabase.from("applicants").select("*").eq("id", id).single();
  if (!applicant) notFound();

  const { data: applications } = await supabase
    .from("applications")
    .select("id, reference_number, amount_requested, status, created_at")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-navy">{applicant.full_name}</h1>
          <p className="text-sm text-brand-muted">{applicant.mobile} · {applicant.residential_address}</p>
        </div>
        <Link
          href={`/applications/new?applicantId=${applicant.id}`}
          className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition"
        >
          + New Application
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label="ID type" value={applicant.id_type === "personal_id" ? "Namibian ID" : "Passport"} />
        <InfoCard label="Marital status" value={applicant.marital_status.replaceAll("_", " ")} />
        <InfoCard label="Dependants" value={String(applicant.dependants_count)} />
        <InfoCard label="Next of kin" value={`${applicant.next_of_kin_name} · ${applicant.next_of_kin_mobile}`} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Applications</h2>
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
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
                  <td className="px-4 py-3">{formatNad(app.amount_requested)}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3 text-brand-muted">{formatDate(app.created_at)}</td>
                </tr>
              ))}
              {!applications?.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">No applications yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
      <div className="text-xs text-brand-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
