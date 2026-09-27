import { requireRole } from "@/lib/current-staff";
import { createClient } from "@/lib/supabase/server";
import { formatNad } from "@/lib/format";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// SRS §9.3: the pilot's own volume/amount guardrails — kept as dated policy_params, not code
// constants, so they can be tightened or relaxed without a deploy. This page is the only place
// that shows compliance against them in real time.
export default async function PilotGuardrailsPage() {
  const staff = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();

  const { data: params } = await supabase
    .from("policy_params")
    .select("param_key, param_value, effective_from, note")
    .eq("tenant_id", staff.tenant_id ?? "")
    .in("param_key", ["pilot_volume_cap_per_week", "pilot_amount_cap_nad"])
    .order("effective_from", { ascending: false });

  const latest = new Map<string, { value: number; note: string | null }>();
  for (const p of params ?? []) {
    if (!latest.has(p.param_key)) latest.set(p.param_key, { value: Number(p.param_value), note: p.note });
  }
  const volumeCap = latest.get("pilot_volume_cap_per_week")?.value ?? null;
  const amountCap = latest.get("pilot_amount_cap_nad")?.value ?? null;

  const weekStart = startOfIsoWeek(new Date());
  const { data: thisWeekApps } = await supabase
    .from("applications")
    .select("id, reference_number, amount_requested, created_at")
    .gte("created_at", weekStart.toISOString())
    .order("created_at", { ascending: false });

  const overCapApps = amountCap != null ? (thisWeekApps ?? []).filter((a) => Number(a.amount_requested) > amountCap) : [];

  const { data: allApps } = await supabase.from("applications").select("id, amount_requested, created_at").order("created_at", { ascending: false }).limit(500);
  const weekBuckets = new Map<string, { count: number; volume: number }>();
  for (const a of allApps ?? []) {
    const wk = startOfIsoWeek(new Date(a.created_at)).toISOString().slice(0, 10);
    const bucket = weekBuckets.get(wk) ?? { count: 0, volume: 0 };
    bucket.count += 1;
    bucket.volume += Number(a.amount_requested);
    weekBuckets.set(wk, bucket);
  }
  const recentWeeks = [...weekBuckets.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  const weekCount = thisWeekApps?.length ?? 0;
  const withinVolumeCap = volumeCap == null || weekCount <= volumeCap;

  return (
    <div className="space-y-space-lg">
      <div>
        <h1 className="text-xl font-bold text-on-surface">Pilot Guardrails</h1>
        <p className="text-sm text-on-surface-variant">
          The pilot&apos;s own volume and amount caps (SRS §9.3) — dated parameters, checked against real intake, not a code constant.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter-desktop">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase text-on-surface-variant tracking-wider font-semibold">Weekly Volume Guardrail</span>
            <span className={`material-symbols-outlined text-[20px] ${withinVolumeCap ? "text-tertiary-container" : "text-error"}`}>
              {withinVolumeCap ? "check_circle" : "warning"}
            </span>
          </div>
          {volumeCap == null ? (
            <p className="text-sm text-warning">Not configured — set <code>pilot_volume_cap_per_week</code> in Policy Parameters.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-on-surface">{weekCount}</span>
                <span className="text-xl font-mono text-on-surface-variant">/ {volumeCap}</span>
              </div>
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className={`h-full ${withinVolumeCap ? "bg-primary-container" : "bg-error"}`} style={{ width: `${Math.min(100, (weekCount / volumeCap) * 100)}%` }} />
              </div>
              <p className="text-[12px] text-on-surface-variant">{Math.max(volumeCap - weekCount, 0)} intake slots remaining this week.</p>
            </>
          )}
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm space-y-space-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase text-on-surface-variant tracking-wider font-semibold">Per-Loan Amount Guardrail</span>
            <span className={`material-symbols-outlined text-[20px] ${overCapApps.length === 0 ? "text-tertiary-container" : "text-error"}`}>
              {overCapApps.length === 0 ? "check_circle" : "warning"}
            </span>
          </div>
          {amountCap == null ? (
            <p className="text-sm text-warning">Not configured — set <code>pilot_amount_cap_nad</code> in Policy Parameters.</p>
          ) : (
            <>
              <div className="text-3xl font-mono font-bold text-on-surface">{formatNad(amountCap)}</div>
              <p className="text-[12px] text-on-surface-variant">
                {overCapApps.length === 0
                  ? "No application this week has exceeded the pilot amount cap."
                  : `${overCapApps.length} application(s) this week requested above the pilot cap.`}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="p-space-lg">
          <h2 className="text-lg font-bold text-on-surface">Weekly Intake History</h2>
          <p className="text-sm text-on-surface-variant">Computed live from application create dates — last 6 weeks with any activity.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-[11px] uppercase tracking-wider h-9">
              <th className="px-space-md py-1 font-semibold">Week Starting</th>
              <th className="px-space-md py-1 text-right font-semibold">Applications</th>
              <th className="px-space-md py-1 text-right font-semibold">Requested Volume</th>
              <th className="px-space-md py-1 text-right font-semibold">Guardrail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-sm">
            {recentWeeks.map(([wk, bucket]) => (
              <tr key={wk}>
                <td className="px-space-md py-2 font-mono text-[13px]">{wk}</td>
                <td className="px-space-md py-2 text-right font-mono">{bucket.count}</td>
                <td className="px-space-md py-2 text-right font-mono">{formatNad(bucket.volume)}</td>
                <td className="px-space-md py-2 text-right">
                  {volumeCap != null && (
                    <span className={`text-[11px] font-semibold ${bucket.count > volumeCap ? "text-error" : "text-tertiary-container"}`}>
                      {bucket.count > volumeCap ? "Over cap" : "Within cap"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!recentWeeks.length && (
              <tr><td colSpan={4} className="px-space-md py-10 text-center text-on-surface-variant">No intake activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
