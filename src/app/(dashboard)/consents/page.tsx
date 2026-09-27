'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { ConsentType } from "@/types/database";

const CONSENT_LABELS: Record<ConsentType, string> = {
  credit_assessment: "Credit Assessment",
  bureau_enquiry_and_submission: "Bureau Enquiry & Submission",
  debt_collection_disclosure: "Debt Collection Disclosure",
  marketing: "Marketing",
  cession_disclosure: "Cession Disclosure",
};

// FR-CONSENT-01/02: five separately withdrawable consent records per applicant — this is the
// tenant-wide audit view across every applicant, not just the one inside an application file.
export default function ConsentsPage() {
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!userData || !['admin', 'super_admin', 'approver'].includes(userData.role)) {
          router.push('/');
          return;
        }

        const { data: consentsData } = await supabase
          .from("consents")
          .select("*, applicants(full_name, id_type)")
          .eq("tenant_id", userData.tenant_id ?? "")
          .order("created_at", { ascending: false })
          .limit(300);

        setConsents(consentsData || []);

      } catch (error) {
        console.error('Error loading consents:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading consents...</p>
        </div>
      </div>
    );
  }

  const totalApplicants = new Set(consents.map((c) => c.applicant_id)).size;
  const grantedCount = consents.filter((c) => c.granted).length;
  const withdrawnCount = consents.filter((c) => c.withdrawn_at).length;

  return (
    <div className="space-y-space-lg">
      <div>
        <h1 className="text-xl font-bold text-on-surface">Consents &amp; KYC</h1>
        <p className="text-sm text-on-surface-variant">Every consent record is captured unbundled (FR-CONSENT-01) — no single checkbox covers more than one purpose.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter-desktop">
        <StatCard label="Applicants with consent records" value={String(totalApplicants)} />
        <StatCard label="Consents granted" value={String(grantedCount)} tone="tertiary" />
        <StatCard label="Consents withdrawn" value={String(withdrawnCount)} tone={withdrawnCount > 0 ? "error" : undefined} />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider h-9">
              <th className="px-space-md py-1 font-semibold">Applicant</th>
              <th className="px-space-md py-1 font-semibold">Consent Type</th>
              <th className="px-space-md py-1 font-semibold">Channel</th>
              <th className="px-space-md py-1 font-semibold">Status</th>
              <th className="px-space-md py-1 font-semibold">Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-sm">
            {consents.map((c) => {
              const applicant = c.applicants as unknown as { full_name: string } | null;
              return (
                <tr key={c.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-space-md py-2 font-medium">{applicant?.full_name ?? "—"}</td>
                  <td className="px-space-md py-2">{CONSENT_LABELS[c.consent_type]}</td>
                  <td className="px-space-md py-2 text-on-surface-variant capitalize">{c.channel ?? "—"}</td>
                  <td className="px-space-md py-2">
                    {c.withdrawn_at ? (
                      <span className="px-space-sm py-0.5 rounded text-[11px] font-semibold bg-error-container text-on-error-container">Withdrawn</span>
                    ) : c.granted ? (
                      <span className="px-space-sm py-0.5 rounded text-[11px] font-semibold bg-tertiary-fixed/40 text-tertiary-container">Granted</span>
                    ) : (
                      <span className="px-space-sm py-0.5 rounded text-[11px] font-semibold bg-surface-container text-on-surface-variant">Declined</span>
                    )}
                  </td>
                  <td className="px-space-md py-2 text-on-surface-variant text-[12px] font-mono">{formatDateTime(c.created_at)}</td>
                </tr>
              );
            })}
            {!consents.length && (
              <tr><td colSpan={5} className="px-space-md py-10 text-center text-on-surface-variant">No consent records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "tertiary" | "error" }) {
  const color = tone === "tertiary" ? "text-tertiary-container" : tone === "error" ? "text-error" : "text-on-surface";
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="text-[11px] uppercase text-on-surface-variant tracking-wider font-semibold mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
