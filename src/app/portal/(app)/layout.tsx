import Image from "next/image";
import Link from "next/link";
import { requireBorrower } from "@/lib/current-borrower";
import PortalSignOutButton from "./PortalSignOutButton";

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const applicant = await requireBorrower();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 shrink-0 border-b border-brand-border bg-brand-surface flex items-center justify-between px-6">
        <Link href="/portal" className="flex items-center gap-3">
          <Image src="/brand/nexora-logo-stacked.png" alt="Nexora Systems" width={36} height={36} />
          <span className="text-sm font-semibold text-brand-navy">TMU CashLoan CC</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brand-muted">{applicant.full_name}</span>
          <PortalSignOutButton />
        </div>
      </header>

      <main className="flex-1 bg-background p-6">
        <div className="max-w-3xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
