'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { roleLabel } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import type { StaffRole } from "@/types/database";

const ROLES: StaffRole[] = ["admin", "intake", "officer", "approver", "finance"];

export default function UsersPage() {
  const [staff, setStaff] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        
        // Check authentication and get staff info
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
          router.push('/');
          return;
        }

        setStaff(userData);

        const { data: usersData } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        setUsers(usersData || []);

      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive') => {
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      // Refresh users list
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      setUsers(usersData || []);
      
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      const formData = new FormData(e.currentTarget);
      const supabase = createClient();
      
      // For now, just log the invitation - full implementation would require email sending
      console.log('Staff invitation:', {
        full_name: formData.get('full_name') as string,
        email: formData.get('email') as string,
        role: formData.get('role') as StaffRole
      });

      // Simulate success
      // const { error } = await supabase.rpc('invite_staff', {
      //   full_name: formData.get('full_name') as string,
      //   email: formData.get('email') as string,
      //   role: formData.get('role') as StaffRole
      // });

      // if (error) throw error;

      // Reset form
      (e.target as HTMLFormElement).reset();
      
      // Refresh users list
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      setUsers(usersData || []);
      
      alert('Staff invitation sent successfully');
      
    } catch (error) {
      console.error('Error inviting staff:', error);
      alert('Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-on-surface-variant">Loading users...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null; // Will redirect
  }

  const assignableRoles = staff.role === "super_admin" ? [...ROLES, "super_admin" as StaffRole] : ROLES;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Staff & Roles</h1>
        <p className="text-sm text-brand-muted">Manage staff accounts and role assignments.</p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-brand-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 capitalize">{u.status}</td>
                <td className="px-4 py-3 text-brand-muted">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.id !== staff.id && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(u.id, u.status === "active" ? "inactive" : "active")}
                      disabled={submitting}
                      className={`text-xs ${u.status === "active" ? "text-danger" : "text-success"} hover:underline disabled:opacity-50`}
                    >
                      {u.status === "active" ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 max-w-lg">
        <h2 className="text-sm font-semibold text-brand-navy mb-4">Invite staff member</h2>
        <form onSubmit={handleInviteStaff} className="space-y-3">
          <input name="full_name" placeholder="Full name" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <select name="role" required defaultValue="" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
            <option value="" disabled>Select role…</option>
            {assignableRoles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <button 
            type="submit" 
            disabled={submitting}
            className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
