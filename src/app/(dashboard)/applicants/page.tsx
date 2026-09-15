import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicantsPage() {
  const supabase = await createClient();
  const { data: applicants } = await supabase
    .from("applicants")
    .select("id, full_name, mobile, marital_status, dependants_count, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-brand-navy">Applicants</h1>
        <Link
          href="/applicants/new"
          className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition"
        >
          + New Applicant
        </Link>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Marital status</th>
              <th className="text-left px-4 py-3">Dependants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {applicants?.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <Link href={`/applicants/${a.id}`} className="text-brand-blue font-medium hover:underline">
                    {a.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.mobile}</td>
                <td className="px-4 py-3 capitalize">{a.marital_status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{a.dependants_count}</td>
              </tr>
            ))}
            {!applicants?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-brand-muted">
                  No applicants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
