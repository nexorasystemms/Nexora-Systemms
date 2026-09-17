import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { borrowerSignOut } from "./actions";

export default async function BorrowerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If unauthenticated (e.g. on /portal/login or /portal/register), render children directly
  if (!user) {
    return <>{children}</>;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let applicant = null;
  if (profile?.applicant_id) {
    const { data: appData } = await supabase
      .from("applicants")
      .select("*")
      .eq("id", profile.applicant_id)
      .maybeSingle();
    applicant = appData;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="flex items-center gap-3">
              <Image
                src="/brand/nexora-logo-horizontal.png"
                alt="Nexora Systems"
                width={130}
                height={35}
                className="h-8 w-auto object-contain"
                priority
              />
              <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                TMU CashLoan Portal
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800">
                {applicant?.full_name ?? profile?.full_name ?? user.email}
              </div>
              <div className="text-xs text-slate-500">
                {user.email}
              </div>
            </div>

            <form action={borrowerSignOut}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4">
          <p className="font-medium text-slate-700">
            TMU CashLoan CC — Registered Microlender (NAMFISA Reg. 25/11/1138)
          </p>
          <p className="mt-1">
            Independence Avenue, Windhoek, Namibia · Powered by Nexora Intelligent Operations Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
