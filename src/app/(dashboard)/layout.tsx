import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/current-staff";
import { NAV_ITEMS, roleLabel } from "@/lib/roles";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const visibleNav = NAV_ITEMS.filter((item) => item.visible(staff.role));

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-brand-navy text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <Image
            src="/brand/nexora-logo-stacked.png"
            alt="Nexora Systems"
            width={110}
            height={110}
            className="mx-auto"
          />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-white/85 hover:bg-white/10 hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 text-xs text-white/50">
          Nexora Intelligent Operations Platform
          <br />
          Cash Loan Module — Pilot
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-brand-border bg-brand-surface flex items-center justify-between px-6">
          <div className="text-sm text-brand-muted">
            {staff.tenant_id ? "TMU CashLoan CC" : "Platform Administration"}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{staff.full_name}</div>
              <div className="text-xs text-brand-muted">{roleLabel(staff.role)}</div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
