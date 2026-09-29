import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
import StatusBadge from "../../components/StatusBadge";
import { formatNad, formatDate } from "../../lib/format";

export default function ApplicantDetailPage() {
  const [applicant, setApplicant] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { id: applicantId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!applicantId) return;

    async function loadApplicantData() {
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

        const { data: applicantData } = await supabase
          .from("applicants")
          .select("*")
          .eq("id", applicantId!)
          .single();

        if (!applicantData) {
          navigate('/dashboard/applicants');
          return;
        }

        setApplicant(applicantData);

        const { data: applicationsData } = await supabase
          .from("applications")
          .select("id, reference_number, amount_requested, status, created_at")
          .eq("applicant_id", applicantId!)
          .order("created_at", { ascending: false });

        setApplications(applicationsData || []);

      } catch (error) {
        console.error('Error loading applicant data:', error);
        navigate('/dashboard/applicants');
      } finally {
        setLoading(false);
      }
    }

    loadApplicantData();
  }, [applicantId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading applicant...</p>
        </div>
      </div>
    );
  }

  if (!applicant) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-brand-navy truncate">{applicant.full_name}</h1>
          <p className="text-sm text-brand-muted">{applicant.mobile} · {applicant.residential_address}</p>
        </div>
        <Link
          to={`/dashboard/applications/new?applicantId=${applicant.id}`}
          className="shrink-0 rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition self-start sm:self-auto"
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

        {/* ── Mobile card list (< md) ── */}
        <div className="md:hidden bg-brand-surface border border-brand-border rounded-xl divide-y divide-brand-border overflow-hidden">
          {applications.map((app) => (
            <div key={app.id} className="p-4 space-y-1">
              <Link to={`/dashboard/applications/${app.id}`} className="text-brand-blue font-semibold hover:underline block">
                {app.reference_number}
              </Link>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-muted">
                <span>{formatNad(app.amount_requested)}</span>
                <StatusBadge status={app.status} />
                <span>{formatDate(app.created_at)}</span>
              </div>
            </div>
          ))}
          {!applications.length && (
            <div className="px-4 py-8 text-center text-brand-muted text-sm">No applications yet.</div>
          )}
        </div>

        {/* ── Desktop table (≥ md) ── */}
        <div className="hidden md:block bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
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
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/applications/${app.id}`} className="text-brand-blue font-medium hover:underline">
                      {app.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatNad(app.amount_requested)}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3 text-brand-muted">{formatDate(app.created_at)}</td>
                </tr>
              ))}
              {!applications.length && (
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