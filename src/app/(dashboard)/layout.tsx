import Image from "next/image";
import { requireStaff } from "@/lib/current-staff";
import { createClient } from "@/lib/supabase/server";
import { NAV_GROUPS, roleLabel } from "@/lib/roles";
import NavLink from "@/components/NavLink";
import SignOutButton from "@/components/SignOutButton";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday -> 7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const [{ data: tenant }, { count: activeCount }, { data: capParam }, { count: weekCount }] = await Promise.all([
    staff.tenant_id
      ? supabase.from("tenants").select("name, namfisa_reg_number").eq("id", staff.tenant_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(settled,declined,withdrawn,handed_over)"),
    staff.tenant_id
      ? supabase
          .from("policy_params")
          .select("param_value")
          .eq("tenant_id", staff.tenant_id)
          .eq("param_key", "pilot_volume_cap_per_week")
          .lte("effective_from", new Date().toISOString().slice(0, 10))
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfIsoWeek(new Date()).toISOString()),
  ]);

  const pilotCap = capParam ? Number(capParam.param_value) : null;
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.visible(staff.role)),
  })).filter((g) => g.items.length > 0);

  const badgeValues: Record<string, string | number> = {
    applications: activeCount ?? 0,
    pilotStatus: pilotCap != null ? `${weekCount ?? 0}/${pilotCap}` : "—",
  };

  return (
    <div data-surface="admin" className="min-h-screen flex bg-background">
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant/40 shadow-sm z-50 flex flex-col justify-between">
        <div className="flex flex-col min-h-0">
          <div className="h-16 flex items-center px-gutter bg-surface-container-low border-b border-outline-variant/30 shrink-0">
            <div className="flex flex-col w-full min-w-0">
              <div className="flex items-center gap-space-xs min-w-0">
                <Image src="/brand/nexora-mark.png" alt="Nexora Systems" width={22} height={22} className="shrink-0" />
                <span className="text-[13px] font-bold text-primary truncate">Nexora Systems</span>
              </div>
              <span className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">
                {tenant?.name ?? "Platform Admin"}{tenant?.namfisa_reg_number ? ` · NAMFISA ${tenant.namfisa_reg_number}` : ""}
              </span>
            </div>
          </div>

          {pilotCap != null && (
            <div className="px-gutter pt-space-md pb-space-xs shrink-0">
              <div className="bg-surface-container rounded p-space-sm flex flex-col gap-space-xs border border-outline-variant/30">
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span className="font-bold uppercase tracking-wide">Pilot Quota (this week)</span>
                  <span className="font-mono text-primary font-bold">{weekCount ?? 0} / {pilotCap}</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${(weekCount ?? 0) >= pilotCap ? "bg-error" : "bg-primary-container"}`}
                    style={{ width: `${Math.min(100, ((weekCount ?? 0) / pilotCap) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 px-space-sm py-space-sm flex flex-col gap-space-xs overflow-y-auto min-h-0">
            {visibleGroups.map((g) => (
              <div key={g.group}>
                <div className="px-space-sm pt-space-xs pb-1 text-[10px] uppercase tracking-wider text-secondary font-bold">{g.group}</div>
                <div className="flex flex-col gap-space-xs">
                  {g.items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      badge={item.badge ? badgeValues[item.badge] : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-space-sm bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-space-xs shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-on-surface truncate">{staff.full_name}</span>
            <SignOutButton />
          </div>
          <span className="text-[11px] text-on-surface-variant truncate">{roleLabel(staff.role)}</span>
          <div className="flex items-center gap-space-xs text-[10px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[13px] text-tertiary-container">lock</span>
            <span className="font-mono">RLS STRICT · SHA-256</span>
          </div>
        </div>
      </aside>

      <div className="pl-64 flex flex-col min-h-screen w-full">
        <header className="h-12 shrink-0 border-b border-outline-variant/40 bg-surface-container-lowest flex items-center justify-between px-gutter-desktop">
          <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container-high border border-outline-variant/50">
            <span className="material-symbols-outlined text-[14px] text-secondary">domain</span>
            <span className="font-mono text-[11px] text-on-surface">
              {tenant?.name ?? "Platform Administration"}{tenant?.namfisa_reg_number ? ` — NAMFISA Reg. ${tenant.namfisa_reg_number}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-secondary-container/50 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[13px] text-secondary">verified_user</span>
            <span className="text-[11px] text-on-secondary-container">Role: {roleLabel(staff.role)}</span>
          </div>
        </header>
        <main className="flex-1 bg-background w-full px-margin-desktop py-space-lg">{children}</main>
      </div>
    </div>
  );
}
