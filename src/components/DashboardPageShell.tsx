import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon: string;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Consistent page header + content wrapper used by all dashboard pages.
 */
export default function DashboardPageShell({ title, subtitle, icon, badge, actions, children }: Props) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed/40 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-on-surface">{title}</h1>
              {badge && (
                <span className="font-mono text-[10px] bg-surface-container text-on-surface-variant border border-outline-variant/50 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}

/** Reusable spinner used while auth / data loads */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-sm text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

/** Reusable "under construction" card */
export function ComingSoonCard({ feature }: { feature: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-10 sm:p-14 text-center">
      <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-5">
        <span className="material-symbols-outlined text-on-surface-variant text-[28px]">construction</span>
      </div>
      <h2 className="text-lg font-semibold text-on-surface mb-2">{feature} is being built</h2>
      <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
        This module is in active development. The underlying data model and Supabase tables are ready —
        the UI will be wired up in the next sprint.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px] border border-outline-variant/40">
        <span className="material-symbols-outlined text-[14px] text-tertiary">check_circle</span>
        Data layer ready · UI in progress
      </div>
    </div>
  );
}
