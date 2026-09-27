'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "./SignOutButton";

export default function BorrowerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
              .select("*")
              .eq("id", profileData.applicant_id)
              .maybeSingle();
            setApplicant(appData);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);

  // Show loading for authenticated pages
  if (loading && user !== null) {
    return (
      <div data-surface="portal" className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading portal...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated (e.g. on /portal/login or /portal/register), render children directly
  if (!user) {
    return <div data-surface="portal">{children}</div>;
  }

  return (
    <div data-surface="portal" className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl shadow-sm">
        <div className="h-20 max-w-5xl mx-auto px-gutter flex items-center justify-between gap-space-md">
          <Link href="/portal" className="flex items-center gap-space-md min-w-0">
            <Image src="/brand/nexora-logo-horizontal.png" alt="Nexora Systems" width={130} height={35} className="h-8 w-auto object-contain" priority />
            <div className="hidden sm:flex flex-col min-w-0">
              <span className="bg-surface-container-high text-primary px-space-sm py-0.5 rounded-full text-[11px] tracking-wider uppercase font-semibold w-fit">
                TMU CashLoan Portal
              </span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">NAMFISA Reg. 25/11/1138 · Windhoek, Namibia</span>
            </div>
          </Link>

          <div className="flex items-center gap-space-md">
            <div className="hidden sm:flex flex-col text-right min-w-0">
              <span className="text-sm font-semibold text-on-surface truncate">{applicant?.full_name ?? profile?.full_name ?? user.email}</span>
              <span className="text-[12px] text-on-surface-variant truncate">{user.email}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="w-full pt-20 flex-1 bg-background">
        <div className="max-w-5xl mx-auto px-gutter py-space-xl">{children}</div>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant/40 py-space-lg text-center text-[12px] text-on-surface-variant">
        <div className="max-w-5xl mx-auto px-gutter">
          <p className="font-medium text-on-surface">TMU CashLoan CC — Registered Microlender (NAMFISA Reg. 25/11/1138)</p>
          <p className="mt-1">Independence Avenue, Windhoek, Namibia · Powered by Nexora Intelligent Operations Platform</p>
        </div>
      </footer>
    </div>
  );
}
