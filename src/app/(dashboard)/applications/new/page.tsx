import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewApplicationForm from "./NewApplicationForm";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ applicantId?: string }>;
}) {
  const { applicantId } = await searchParams;

  if (!applicantId) {
    const supabase = await createClient();
    const { data: applicants } = await supabase
      .from("applicants")
      .select("id, full_name, mobile")
      .order("created_at", { ascending: false })
      .limit(20);

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy">New Loan Application</h1>
            <p className="text-xs text-brand-muted mt-0.5">
              Step 1 of 2: Select a verified applicant or register a new applicant profile.
            </p>
          </div>
          <Link
            href="/applicants/new"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-navy hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            + Register New Applicant
          </Link>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Existing Applicant
            </span>
            <span className="text-[11px] text-brand-muted">Showing recent applicants</span>
          </div>

          <div className="divide-y divide-brand-border border border-brand-border rounded-lg overflow-hidden bg-white">
            {applicants && applicants.length > 0 ? (
              applicants.map((a) => (
                <Link
                  key={a.id}
                  href={`/applications/new?applicantId=${a.id}`}
                  className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-50 transition group"
                >
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-brand-blue">
                      {a.full_name}
                    </span>
                    <span className="text-brand-muted ml-2">({a.mobile})</span>
                  </div>
                  <span className="text-brand-blue font-medium group-hover:translate-x-0.5 transition-transform">
                    Select →
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No applicants found. Click &ldquo;+ Register New Applicant&rdquo; above to create one.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-teal-50/60 border border-teal-200/70 rounded-xl text-xs text-teal-900 leading-relaxed">
          🛡️ <strong>Rule R-15 Compliance:</strong> Before creating an application, the system validates whether the applicant already has an active or unsettled loan in accordance with regulatory concurrency guidelines.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase.from("applicants").select("id, full_name").eq("id", applicantId).single();

  if (!applicant) {
    return <p className="text-danger">Applicant not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-brand-navy">New Application</h1>
      <NewApplicationForm applicantId={applicant.id} applicantName={applicant.full_name} />
    </div>
  );
}
