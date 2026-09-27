import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
import { formatNad } from "../../lib/format";

// FR-RPT-02: every loan in_arrears, days past due, penalty accrued, 90-day hand-over flag.
export default function ArrearsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
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

        const { data: eventsData } = await supabase
          .from("arrears_events")
          .select("*, loans(id, application_id, disbursed_amount, applications(reference_number, applicants(full_name)))")
          .order("days_past_due", { ascending: false });

        setEvents(eventsData || []);

      } catch (error) {
        console.error('Error loading arrears:', error);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading arrears...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Arrears Dashboard</h1>
        <p className="text-sm text-brand-muted">FR-REPAY-03/04 — the 90-day penalty-cap clock is tracked automatically, not by hand.</p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Loan</th>
              <th className="text-left px-4 py-3">Applicant</th>
              <th className="text-left px-4 py-3">Days past due</th>
              <th className="text-left px-4 py-3">Penalty accrued</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {events.map((e) => {
              type LoanJoin = { id: string; application_id: string; applications: { reference_number: string; applicants: { full_name: string } } };
              const loan = e.loans as unknown as LoanJoin;
              return (
                <tr key={e.id} className={e.hand_over_required ? "bg-red-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/applications/${loan.application_id}`} className="text-brand-blue font-medium hover:underline">
                      {loan.applications.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{loan.applications.applicants.full_name}</td>
                  <td className="px-4 py-3 font-medium">{e.days_past_due}d</td>
                  <td className="px-4 py-3">{formatNad(e.penalty_charged)}</td>
                  <td className="px-4 py-3">
                    {e.hand_over_required ? (
                      <span className="text-danger font-medium">Hand-over decision required</span>
                    ) : (
                      <span className="capitalize">{e.status}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!events?.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-brand-muted">No loans currently in arrears.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-brand-muted">
        Arrears events are raised by <span className="font-mono">raise_arrears_events()</span> (migration 0008), which needs
        to run once a day — enable the pg_cron extension in the Supabase dashboard and schedule it, or call it daily from
        an external scheduler. See the comment at the bottom of that migration file.
      </p>
    </div>
  );
}