'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ApplicantsPage() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadApplicants() {
      try {
        const supabase = createClient();
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!userData || userData.role === 'borrower') {
          router.push('/login');
          return;
        }

        const { data: applicantsData } = await supabase
          .from("applicants")
          .select("id, full_name, mobile, marital_status, dependants_count, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        setApplicants(applicantsData || []);

      } catch (error) {
        console.error('Error loading applicants:', error);
      } finally {
        setLoading(false);
      }
    }

    loadApplicants();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading applicants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-brand-navy">Applicants</h1>
        <Link
          href="/applicants/new"
          className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition"
        >
          + New Applicant
        </Link>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Mobile</th>
              <th className="text-left px-4 py-3">Marital status</th>
              <th className="text-left px-4 py-3">Dependants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {applicants.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <Link href={`/applicants/${a.id}`} className="text-brand-blue font-medium hover:underline">
                    {a.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{a.mobile}</td>
                <td className="px-4 py-3 capitalize">{a.marital_status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{a.dependants_count}</td>
              </tr>
            ))}
            {!applicants.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-brand-muted">
                  No applicants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
