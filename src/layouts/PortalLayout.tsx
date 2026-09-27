import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "@/pages/portal/SignOutButton";

// Routes where we don't show the authenticated header (login/register)
const UNAUTHENTICATED_PATHS = ["/portal/login", "/portal/register"];

export default function PortalLayout() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const isUnauthenticatedPage = UNAUTHENTICATED_PATHS.includes(location.pathname);

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const { data: { user: userData } } = await supabase.auth.getUser();
        setUser(userData);

        if (userData) {
          const { data: profileData } = await supabase
            .from("users")
            .select("*")
            .eq("id", userData.id)
            .maybeSingle();

          setProfile(profileData);

          if (profileData?.applicant_id) {
            const { data: appData } = await supabase
              .from("applicants")
              .select("full_name")
              .eq("id", profileData.applicant_id)
              .maybeSingle();
            setApplicant(appData);
          }
        }
      } catch (error) {
        console.error("Error loading portal user data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [location.pathname]);

  // On auth pages, render children directly without the portal chrome
  if (isUnauthenticatedPage) {
    return <div data-surface="portal"><Outlet /></div>;
  }

  if (loading) {
    return (
      <div data-surface="portal" className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-surface="portal" className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl shadow-sm">
        <div className="h-20 max-w-5xl mx-auto px-gutter flex items-center justify-between gap-space-md">
          <Link to="/portal" className="flex items-center gap-space-md min-w-0">
            <img
              src="/brand/nexora-logo-horizontal.png"
              alt="Nexora Systems"
              className="h-8 w-auto object-contain"
            />
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="bg-surface-container-high text-primary px-space-sm py-0.5 rounded-full text-[11px] tracking-wider uppercase font-semibold w-fit">
                TMU CashLoan Portal
              </span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">
                NAMFISA Reg. 25/11/1138 · Windhoek, Namibia
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-space-md">
            {user ? (
              <>
                <div className="hidden sm:flex flex-col text-right min-w-0">
                  <span className="text-sm font-semibold text-on-surface truncate">
                    {applicant?.full_name ?? profile?.full_name ?? user.email}
                  </span>
                  <span className="text-[12px] text-on-surface-variant truncate">{user.email}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </div>
                <SignOutButton />
              </>
            ) : (
              <Link
                to="/portal/login"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="w-full pt-20 flex-1 bg-background">
        <div className="max-w-5xl mx-auto px-gutter py-space-xl">
          <Outlet />
        </div>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant/40 py-space-lg text-center text-[12px] text-on-surface-variant">
        <div className="max-w-5xl mx-auto px-gutter">
          <p className="font-medium text-on-surface">
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
