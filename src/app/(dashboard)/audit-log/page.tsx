'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";

// FR-CORE-23: compliance/approver roles can view the full audit trail in a human-readable
// timeline, filtered by entity/actor/date. Filtering UI is minimal in this first pass —
// query params are read client-side for dynamic filtering.
export default function AuditLogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadData() {
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

        const entity_type = searchParams.get('entity_type');
        const entity_id = searchParams.get('entity_id');

        let query = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
        if (entity_type) query = query.eq("entity_type", entity_type);
        if (entity_id) query = query.eq("entity_id", entity_id);
        
        const { data: entriesData } = await query;
        setEntries(entriesData || []);

      } catch (error) {
        console.error('Error loading audit log:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading audit log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Audit Log</h1>
        <p className="text-sm text-brand-muted">Append-only, hash-chained (FR-CORE-20/21/22). Nothing here can be edited or deleted.</p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-brand-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">Actor</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Entity</th>
              <th className="text-left px-4 py-3">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border font-mono">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-sans">{formatDateTime(e.created_at)}</td>
                <td className="px-4 py-2 font-sans">{e.actor_type}{e.actor_id ? ` · ${e.actor_id.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2 font-sans">{e.action}</td>
                <td className="px-4 py-2 font-sans">{e.entity_type}{e.entity_id ? ` · ${e.entity_id.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2 text-[10px] text-brand-muted">{e.record_hash ? `${e.record_hash.slice(0, 16)}…` : "—"}</td>
              </tr>
            ))}
            {!entries.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-brand-muted font-sans">No audit events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
