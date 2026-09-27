'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime } from "@/lib/format";

const KNOWN_PARAMS = [
  "loan_ceiling_nad", "term_ceiling_months", "finance_charge_cap_short_term_months",
  "finance_charge_cap_short_pct", "finance_charge_cap_long_prime_multiplier", "prime_rate_pct",
  "penalty_cap_pct", "penalty_duration_days", "alpha_instalment_coverage", "beta_dsr_ceiling",
  "min_living_allowance_nad", "income_variance_threshold_pct", "expenditure_plausibility_min_pct",
  "pilot_volume_cap_per_week", "pilot_amount_cap_nad",
];

export default function PolicyParamsPage() {
  const [staff, setStaff] = useState<any>(null);
  const [params, setParams] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
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

        if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
          router.push('/');
          return;
        }

        setStaff(userData);

        const [{ data: paramsData }, { data: templatesData }] = await Promise.all([
          supabase
            .from("policy_params")
            .select("*")
            .eq("tenant_id", userData.tenant_id ?? "")
            .order("param_key")
            .order("effective_from", { ascending: false }),
          supabase
            .from("agreement_templates")
            .select("*")
            .eq("tenant_id", userData.tenant_id ?? "")
            .order("created_at", { ascending: false })
        ]);

        setParams(paramsData || []);
        setTemplates(templatesData || []);

      } catch (error) {
        console.error('Error loading policy params:', error);
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
          <p className="mt-4 text-on-surface-variant">Loading policy parameters...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null; // Will redirect
  }

  const latestByKey = new Map<string, any>();
  for (const p of params) if (!latestByKey.has(p.param_key)) latestByKey.set(p.param_key, p);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Policy Parameters</h1>
        <p className="text-sm text-brand-muted">
          Every regulatory/business number is a dated row (FR-CORE-40/41) — changing one adds a new row, it never
          overwrites the old one, so a historical assessment always re-computes using the parameters in force on its date.
        </p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Key</th>
              <th className="text-left px-4 py-3">Current value</th>
              <th className="text-left px-4 py-3">Effective from</th>
              <th className="text-left px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {KNOWN_PARAMS.map((key) => {
              const row = latestByKey.get(key);
              return (
                <tr key={key}>
                  <td className="px-4 py-3 font-mono text-xs">{key}</td>
                  <td className="px-4 py-3 font-medium">{row?.param_value ?? "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{row ? formatDate(row.effective_from) : "—"}</td>
                  <td className="px-4 py-3 text-brand-muted text-xs">{row?.note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Agreement Templates</h2>
          <p className="text-xs text-brand-muted">
            FR-AGR-08: a template cannot generate a live agreement until a compliance-role user records that TMU's
            attorney has reviewed it. FR-AGR-05: do not mark a template active with a notary-presence clause unless that is
            genuinely performed and confirmed in writing.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-brand-surface border border-brand-border rounded-xl p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.name} v{t.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
              </div>
              {t.includes_notary_clause && <p className="text-xs text-warning">Includes a notary-presence clause — confirm this is genuinely performed.</p>}
              <p className="text-xs text-brand-muted">
                {t.attorney_reviewed ? `Attorney-reviewed ${formatDateTime(t.attorney_reviewed_at)}` : "Not yet attorney-reviewed"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}