import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "@/pages/portal/SignOutButton";
import { usePageTitle } from "@/lib/usePageTitle";
import { TMU_ROOT, tmuAssets, tmuContact, tmuPortal } from "@/lib/tenants";

// Routes that render without the authenticated portal chrome
const UNAUTHENTICATED_PATHS: string[] = [tmuPortal.login, tmuPortal.register];

export default function PortalLayout() {
  const [user, setUser]         = useState<any>(null);
  const [profile, setProfile]   = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  usePageTitle("TMU CashLoan — Borrower Portal");
  const location = useLocation();

  const isUnauthenticated = UNAUTHENTICATED_PATHS.includes(location.pathname);

  // Close mobile menu on navigation
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        setUser(u);
        if (u) {
          const { data: prof } = await supabase.from("users").select("*").eq("id", u.id).maybeSingle();
          setProfile(prof);
          if (prof?.applicant_id) {
            const { data: app } = await supabase.from("applicants").select("full_name").eq("id", prof.applicant_id).maybeSingle();
            setApplicant(app);
          }
        }
      } catch (e) {
        console.error("PortalLayout user load:", e);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [location.pathname]);

  // Unauthenticated pages: no chrome
  if (isUnauthenticated) {
    return <div data-surface="tmu"><Outlet /></div>;
  }

  if (loading) {
    return (
      <div data-surface="tmu" className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-on-surface-variant">Loading portal…</p>
        </div>
      </div>
    );
  }

  const displayName = applicant?.full_name ?? profile?.full_name ?? user?.email ?? "";

  return (
    <div data-surface="tmu" className="min-h-screen bg-background flex flex-col">

      <div className="fixed top-0 left-0 right-0 z-50">
      <header className="bg-surface-container-lowest shadow-sm border-b border-outline-variant">
        <div className="h-16 sm:h-20 max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">

          <Link to={tmuPortal.home} className="flex items-center gap-3 min-w-0 shrink-0 h-12 overflow-hidden">
            <img
              src={tmuAssets.logo}
              alt="TMU Capital Pty Ltd"
              className="block h-10 w-[180px] sm:h-11 sm:w-[210px] object-contain object-left shrink-0"
            />
          </Link>

          {/* Right: desktop user info + sign-out */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* User info — hidden on xs */}
                <div className="hidden sm:flex flex-col text-right min-w-0">
                  <span className="text-sm font-semibold text-on-surface truncate max-w-[180px]">{displayName}</span>
                  <Link to={tmuPortal.account} className="text-[12px] text-on-surface-variant truncate max-w-[180px] hover:text-primary hover:underline">
                    {user.email}
                  </Link>
                </div>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </div>
                {/* Sign out — hidden on xs; shown on sm+ */}
                <div className="hidden sm:block"><SignOutButton /></div>
                {/* Mobile menu toggle */}
                <button
                  type="button"
                  className="sm:hidden min-h-11 min-w-11 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label="Menu"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {mobileMenuOpen ? "close" : "more_vert"}
                  </span>
                </button>
              </>
            ) : (
              <Link to={tmuPortal.login}
                className="text-sm font-semibold text-primary hover:underline min-h-[44px] flex items-center">
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* ── Mobile dropdown menu (xs only) ── */}
        {mobileMenuOpen && user && (
          <div className="sm:hidden border-t border-outline-variant/30 bg-surface-container-lowest px-4 py-3 space-y-1 shadow-lg">
            {/* User info row */}
            <div className="px-3 py-2 text-sm">
              <div className="font-semibold text-on-surface truncate">{displayName}</div>
              <div className="text-[12px] text-on-surface-variant truncate">{user.email}</div>
            </div>
            <div className="border-t border-outline-variant/20 pt-2 space-y-1">
              <Link to={tmuPortal.home}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px] text-primary">dashboard</span>
                My Dashboard
              </Link>
              <Link to={tmuPortal.apply}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
                Apply for a Loan
              </Link>
              <Link to={tmuPortal.account}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px] text-primary">mail</span>
                Change email
              </Link>
              <Link to={TMU_ROOT}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[18px] text-secondary">home</span>
                TMU Home Page
              </Link>
            </div>
            <div className="border-t border-outline-variant/20 pt-2">
              <div className="px-3 py-2">
                <SignOutButton />
              </div>
            </div>
          </div>
        )}
      </header>
      </div>

      <main className="w-full pt-16 sm:pt-20 flex-1 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-space-xl">
          <Outlet />
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-inverse-surface text-[#acacac] py-space-lg text-center text-[12px] px-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-medium text-white">TMU CashLoan CC — Registered Microlender (NAMFISA Reg. 25/11/1138)</p>
          <p className="mt-1">{tmuContact.address} · Powered by Nexora Systems</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <Link to={TMU_ROOT} className="hover:text-on-surface transition-colors">TMU Home</Link>
            <Link to={tmuPortal.login} className="hover:text-on-surface transition-colors">Sign In</Link>
            <Link to={tmuPortal.register} className="hover:text-on-surface transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
