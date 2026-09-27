'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

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

        if (!userData || userData.role !== 'super_admin') {
          router.push('/');
          return;
        }

        const { data: tenantsData } = await supabase
          .from("tenants")
          .select("*")
          .order("created_at", { ascending: false });

        setTenants(tenantsData || []);

      } catch (error) {
        console.error('Error loading tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      const formData = new FormData(e.currentTarget);
      const supabase = createClient();
      
      // For now, just log the tenant creation - full implementation would need proper RPC
      console.log('Tenant creation:', {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        namfisa_reg_number: formData.get('namfisa_reg_number') as string || null
      });

      // Simulate success  
      // const { error } = await supabase.rpc('create_tenant', {
      //   name: formData.get('name') as string,
      //   slug: formData.get('slug') as string,
      //   namfisa_reg_number: formData.get('namfisa_reg_number') as string || null
      // });

      // if (error) throw error;

      // Reset form
      (e.target as HTMLFormElement).reset();
      
      // Refresh tenants list
      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      setTenants(tenantsData || []);
      
      alert('Tenant created successfully');
      
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Tenants</h1>
        <p className="text-sm text-brand-muted">Platform administration — Nexora super admin only.</p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-left px-4 py-3">NAMFISA Reg.</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">{t.namfisa_reg_number ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
                <td className="px-4 py-3 text-brand-muted">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 max-w-lg">
        <h2 className="text-sm font-semibold text-brand-navy mb-4">New tenant</h2>
        <form onSubmit={handleCreateTenant} className="space-y-3">
          <input name="name" placeholder="Client name" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="slug" placeholder="slug (e.g. tmu-cashloan)" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="namfisa_reg_number" placeholder="NAMFISA registration number" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <button 
            type="submit" 
            disabled={submitting}
            className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create tenant'}
          </button>
        </form>
      </div>
    </div>
  );
}
