import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";

export default function ApplicantsPage() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadApplicants() {
      try {
        const supabase = createClient();
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!userData || userData.role === 'borrower') {
          navigate('/login');
          return;
        }

        const { data: applicantsData } = await supabase
          .from("applicants")
          .select("id, full_name, mobile, marital_status, dependants_count, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        setApplicants(applicantsData || []);

      } catch (error) {
        console.error('Error loading applicants:', error);
      } finally {
        setLoading(false);
      }
    }

    loadApplicants();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading applicants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-brand-navy">Applicants</h1>
        <Link
          to="/dashboard/applicants/new"
          className="shrink-0 rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition"
        >
          + New Applicant
        </Link>
      </div>

      {/* ── Mobile card list (< md) ── */}
      <div className="md:hidden bg-brand-surface border border-brand-border rounded-xl divide-y divide-brand-border overflow-hidden">
        {applicants.map((a) => (
          <div key={a.id} className="p-4 space-y-1">
            <Link to={`/dashboard/applicants/${a.id}`} className="text-brand-blue font-semibold hover:underline block">
              {a.full_name}
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-muted">
              <span>{a.mobile}</span>
              <span className="capitalize">{a.marital_status.replaceAll("_", " ")}</span>
              <span>{a.dependants_count} dependant{a.dependants_count !== 1 ? "s" : ""}</span>
            </div>
          </div>
        ))}
        {!applicants.length && (
          <div className="px-4 py-10 text-center text-brand-muted text-sm">No applicants yet.</div>
        )}
      </div>

      {/* ── Desktop table (≥ md) ── */}
      <div className="hidden md:block bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
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
            {applicants.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <Link to={`/dashboard/applicants/${a.id}`} className="text-brand-blue font-medium hover:underline">
                    {a.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.mobile}</td>
                <td className="px-4 py-3 capitalize">{a.marital_status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{a.dependants_count}</td>
              </tr>
            ))}
            {!applicants.length && (
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