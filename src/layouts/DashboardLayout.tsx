import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { NAV_GROUPS, roleLabel } from "@/lib/roles";
import NavLink from "@/components/NavLink";
import SignOutButton from "@/components/SignOutButton";
import { usePageTitle } from "@/lib/usePageTitle";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [pilotCap, setPilotCap] = useState<number | null>(null);
  const [weekCount, setWeekCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  usePageTitle(tenant?.name ? `Dashboard — ${tenant.name}` : "Staff Dashboard");

  // Close sidebar when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function loadLayoutData() {
      if (!user) return;
      try {
        const supabase = createClient();
        const [
          { data: tenantData },
          { count: activeCountData },
          { data: capParam },
          { count: weekCountData }
        ] = await Promise.all([
          user.tenant_id
            ? supabase.from("tenants").select("name, namfisa_reg_number").eq("id", user.tenant_id).single()
            : Promise.resolve({ data: null }),
          supabase
            .from("applications")
            .select("id", { count: "exact", head: true })
            .not("status", "in", "(settled,declined,withdrawn,handed_over)"),
          user.tenant_id
            ? supabase
                .from("policy_params")
                .select("param_value")
                .eq("tenant_id", user.tenant_id)
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
        setTenant(tenantData);
        setActiveCount(activeCountData ?? 0);
        setPilotCap(capParam ? Number(capParam.param_value) : null);
        setWeekCount(weekCountData ?? 0);
      } catch (error) {
        console.error("Error loading layout data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadLayoutData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-on-surface-variant">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.visible(user.role!)),
  })).filter((g) => g.items.length > 0);

  const badgeValues: Record<string, string | number> = {
    applications: activeCount,
    pilotStatus: pilotCap != null ? `${weekCount}/${pilotCap}` : "—",
  };

  const SidebarContent = () => (
    <>
      <div className="flex flex-col min-h-0 flex-1">
        {/* Sidebar header */}
        <div className="h-16 flex items-center px-space-md bg-surface-container-low border-b border-outline-variant/30 shrink-0">
          <div className="flex flex-col w-full min-w-0">
            <div className="flex items-center gap-space-xs min-w-0">
              <img src="/brand/nexora-mark.png" alt="Nexora" width={22} height={22} className="shrink-0" />
              <span className="text-[13px] font-bold text-primary truncate">Nexora Systems</span>
            </div>
            <span className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">
              {tenant?.name ?? "Platform Admin"}
              {tenant?.namfisa_reg_number ? ` · NAMFISA ${tenant.namfisa_reg_number}` : ""}
            </span>
          </div>
        </div>

        {/* Pilot quota bar */}
        {pilotCap != null && (
          <div className="px-space-md pt-space-md pb-space-xs shrink-0">
            <div className="bg-surface-container rounded p-space-sm flex flex-col gap-space-xs border border-outline-variant/30">
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                <span className="font-bold uppercase tracking-wide">Pilot Quota (this week)</span>
                <span className="font-mono text-primary font-bold">{weekCount} / {pilotCap}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${weekCount >= pilotCap ? "bg-error" : "bg-primary-container"}`}
                  style={{ width: `${Math.min(100, (weekCount / pilotCap) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-space-sm py-space-sm flex flex-col gap-space-xs overflow-y-auto min-h-0">
          {visibleGroups.map((g) => (
            <div key={g.group}>
              <div className="px-space-sm pt-space-xs pb-1 text-[10px] uppercase tracking-wider text-secondary font-bold">
                {g.group}
              </div>
              <div className="flex flex-col gap-space-xs">
                {g.items.map((item) => (
                  <div key={item.href} onClick={() => setSidebarOpen(false)}>
                    <NavLink
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      badge={item.badge ? badgeValues[item.badge] : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User footer */}
      <div className="p-space-sm bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-space-xs shrink-0">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-on-surface truncate">{user.full_name}</span>
          <SignOutButton />
        </div>
        <span className="text-[11px] text-on-surface-variant truncate">{roleLabel(user.role!)}</span>
        <div className="flex items-center gap-space-xs text-[10px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[13px] text-tertiary-container">lock</span>
          <span className="font-mono">RLS STRICT · SHA-256</span>
        </div>
      </div>
    </>
  );

  return (
    <div data-surface="admin" className="min-h-screen flex bg-background">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant/40
          shadow-lg z-50 flex flex-col justify-between
          transform transition-transform duration-250 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-col min-h-screen w-full lg:pl-64">

        {/* Top header */}
        <header className="sticky top-0 z-30 h-12 shrink-0 border-b border-outline-variant/40 bg-surface-container-lowest flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              className="lg:hidden p-2 -ml-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>

            {/* Tenant badge */}
            <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container-high border border-outline-variant/50">
              <span className="material-symbols-outlined text-[14px] text-secondary">domain</span>
              <span className="font-mono text-[11px] text-on-surface truncate max-w-[160px] sm:max-w-none">
                {tenant?.name ?? "Platform Administration"}
                {tenant?.namfisa_reg_number ? ` — NAMFISA ${tenant.namfisa_reg_number}` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-secondary-container/50 border border-outline-variant/40">
            <span className="material-symbols-outlined text-[13px] text-secondary">verified_user</span>
            <span className="text-[11px] text-on-secondary-container">
              <span className="hidden sm:inline">Role: </span>{roleLabel(user.role!)}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-background w-full px-4 md:px-8 py-space-lg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
