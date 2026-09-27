'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatNad } from "@/lib/format";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday -> 7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// SRS §9.3: the pilot's own volume/amount guardrails — kept as dated policy_params, not code
// constants, so they can be tightened or relaxed without a deploy. This page is the only place
// that shows compliance against them in real time.
export default function PilotGuardrailsPage() {
  const [staff, setStaff] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [params, setParams] = useState<any[]>([]);
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

        const [{ data: appsData }, { data: paramsData }] = await Promise.all([
          supabase.from("applications").select("*").order("created_at", { ascending: false }),
          supabase
            .from("policy_params")
            .select("*")
            .eq("tenant_id", userData.tenant_id ?? "")
            .in("param_key", ["pilot_volume_cap_per_week", "pilot_amount_cap_nad"])
        ]);

        setApplications(appsData || []);
        setParams(paramsData || []);

      } catch (error) {
        console.error('Error loading pilot guardrails:', error);
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
          <p className="mt-4 text-on-surface-variant">Loading pilot guardrails...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null; // Will redirect
  }

  // Calculate derived values from state
  const latest = new Map<string, { value: number; note: string | null }>();
  for (const p of params) {
    if (!latest.has(p.param_key)) latest.set(p.param_key, { value: Number(p.param_value), note: p.note });
  }
  const volumeCap = latest.get("pilot_volume_cap_per_week")?.value ?? null;
  const amountCap = latest.get("pilot_amount_cap_nad")?.value ?? null;

  const weekStart = startOfIsoWeek(new Date());
  const thisWeekApps = applications.filter(a => new Date(a.created_at) >= weekStart);
  const overCapApps = amountCap != null ? thisWeekApps.filter((a) => Number(a.amount_requested) > amountCap) : [];

  const weekBuckets = new Map<string, { count: number; volume: number }>();
  for (const a of applications.slice(0, 500)) {
    const wk = startOfIsoWeek(new Date(a.created_at)).toISOString().slice(0, 10);
    const bucket = weekBuckets.get(wk) ?? { count: 0, volume: 0 };
    bucket.count += 1;
    bucket.volume += Number(a.amount_requested);
    weekBuckets.set(wk, bucket);
  }
  const recentWeeks = [...weekBuckets.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);

  const weekCount = thisWeekApps.length;
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
