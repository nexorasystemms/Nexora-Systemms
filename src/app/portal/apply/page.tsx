'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ApplyForm from "./ApplyForm";

export default function BorrowerApplyPage() {
  const [user, setUser] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/portal/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!userData || userData.role !== 'borrower') {
          router.push('/portal/login');
          return;
        }

        setUser(userData);

        if (userData.applicant_id) {
          const { data: applicantData } = await supabase
            .from('applicants')
            .select('*')
            .eq('id', userData.applicant_id)
            .single();

          setApplicant(applicantData);
        }

      } catch (error) {
        console.error('Error loading user data:', error);
        router.push('/portal/login');
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading application form...</p>
        </div>
      </div>
    );
  }

  if (!user || !applicant) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-3xl mx-auto py-2">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">
          Apply for a Cash Loan
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Fast, transparent, and regulated under the Microlending Act 7 of 2018 (NAMFISA Reg. 25/11/1138).
        </p>
      </div>

      <ApplyForm applicantName={applicant?.full_name ?? user.full_name} />
    </div>
  );
}
