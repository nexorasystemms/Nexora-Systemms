import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/current-staff";
import { roleLabel } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { inviteStaff, setStaffStatus } from "./actions";
import type { StaffRole } from "@/types/database";

const ROLES: StaffRole[] = ["admin", "intake", "officer", "approver", "finance"];

export default async function UsersPage() {
  const staff = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  const assignableRoles = staff.role === "super_admin" ? [...ROLES, "super_admin" as StaffRole] : ROLES;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Staff & Roles</h1>
        <p className="text-sm text-brand-muted">
          Every sign-in requires a 6-digit code emailed at login, in place of the
          authenticator-app second factor FR-CORE-03 originally specified.
        </p>
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
            {users?.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 capitalize">{u.status}</td>
                <td className="px-4 py-3 text-brand-muted">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.id !== staff.id && (
                    <form action={setStaffStatus.bind(null, u.id, u.status === "active" ? "inactive" : "active")}>
                      <button type="submit" className={`text-xs ${u.status === "active" ? "text-danger" : "text-success"} hover:underline`}>
                        {u.status === "active" ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 max-w-lg">
        <h2 className="text-sm font-semibold text-brand-navy mb-4">Invite staff member</h2>
        <form action={inviteStaff} className="space-y-3">
          <input name="full_name" placeholder="Full name" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="Email" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <select name="role" required defaultValue="" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
            <option value="" disabled>Select role…</option>
            {assignableRoles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <button type="submit" className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition">
            Send invite
          </button>
        </form>
      </div>
    </div>
  );
}
