import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/current-staff";
import { formatDate, formatDateTime } from "@/lib/format";
import { addPolicyParam, activateTemplate, recordAttorneyReview, createTemplate } from "./actions";

const KNOWN_PARAMS = [
  "loan_ceiling_nad", "term_ceiling_months", "finance_charge_cap_short_term_months",
  "finance_charge_cap_short_pct", "finance_charge_cap_long_prime_multiplier", "prime_rate_pct",
  "penalty_cap_pct", "penalty_duration_days", "alpha_instalment_coverage", "beta_dsr_ceiling",
  "min_living_allowance_nad", "income_variance_threshold_pct", "expenditure_plausibility_min_pct",
  "pilot_volume_cap_per_week", "pilot_amount_cap_nad",
];

export default async function PolicyParamsPage() {
  const staff = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();

  const { data: params } = await supabase
    .from("policy_params")
    .select("*")
    .eq("tenant_id", staff.tenant_id ?? "")
    .order("param_key")
    .order("effective_from", { ascending: false });

  const { data: templates } = await supabase
    .from("agreement_templates")
    .select("*")
    .eq("tenant_id", staff.tenant_id ?? "")
    .order("created_at", { ascending: false });

  const latestByKey = new Map<string, (typeof params extends (infer T)[] | null ? T : never)>();
  for (const p of params ?? []) if (!latestByKey.has(p.param_key)) latestByKey.set(p.param_key, p);

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
                  <td className="px-4 py-3 font-medium">{row ? String(row.param_value) : <span className="text-warning">not set</span>}</td>
                  <td className="px-4 py-3 text-brand-muted">{row ? formatDate(row.effective_from) : "—"}</td>
                  <td className="px-4 py-3 text-brand-muted text-xs">{row?.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 max-w-xl">
        <h2 className="text-sm font-semibold text-brand-navy mb-4">Add a dated parameter change</h2>
        <form action={addPolicyParam} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Parameter key</label>
            <input name="param_key" list="known-params" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            <datalist id="known-params">{KNOWN_PARAMS.map((k) => <option key={k} value={k} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Value</label>
            <input name="param_value" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Effective from</label>
            <input name="effective_from" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Note (why is this changing?)</label>
            <input name="note" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition">
              Add dated row
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Agreement Templates</h2>
          <p className="text-xs text-brand-muted">
            FR-AGR-08: a template cannot generate a live agreement until a compliance-role user records that TMU&apos;s
            attorney has reviewed it. FR-AGR-05: do not mark a template active with a notary-presence clause unless that is
            genuinely performed and confirmed in writing.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates?.map((t) => (
            <div key={t.id} className="bg-brand-surface border border-brand-border rounded-xl p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.name} v{t.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
              </div>
              {t.includes_notary_clause && <p className="text-xs text-warning">Includes a notary-presence clause — confirm this is genuinely performed.</p>}
              <p className="text-xs text-brand-muted">
                {t.attorney_reviewed ? `Attorney-reviewed ${formatDateTime(t.attorney_reviewed_at)}` : "Not yet attorney-reviewed"}
              </p>
              <div className="flex gap-2">
                {!t.attorney_reviewed && (
                  <form action={recordAttorneyReview.bind(null, t.id)}>
                    <button type="submit" className="text-xs rounded-md border border-brand-navy text-brand-navy px-3 py-1.5 hover:bg-brand-navy hover:text-white transition">
                      Record attorney review
                    </button>
                  </form>
                )}
                {t.attorney_reviewed && t.status !== "active" && (
                  <form action={activateTemplate.bind(null, t.id)}>
                    <button type="submit" className="text-xs rounded-md bg-brand-navy text-white px-3 py-1.5 hover:bg-brand-navy-light transition">
                      Activate
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

        <details className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <summary className="text-sm font-medium text-brand-navy cursor-pointer">+ New template</summary>
          <form action={createTemplate} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input name="name" placeholder="Template name" required className="rounded-md border border-brand-border px-3 py-2 text-sm" />
              <input name="version" placeholder="Version (e.g. 1.0)" required className="rounded-md border border-brand-border px-3 py-2 text-sm" />
            </div>
            <textarea name="content" placeholder="Template content / clauses" rows={6} required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includes_notary_clause" /> Includes notary-presence clause</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includes_cession_clause" /> Includes cession/assignment clause</label>
            <button type="submit" className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition">Create template (draft)</button>
          </form>
        </details>
      </div>
    </div>
  );
}
