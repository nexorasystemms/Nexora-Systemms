import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/current-staff";
import { formatDate } from "@/lib/format";
import { createTenant } from "./actions";

export default async function TenantsPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data: tenants } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });

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
            {tenants?.map((t) => (
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
        <form action={createTenant} className="space-y-3">
          <input name="name" placeholder="Client name" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="slug" placeholder="slug (e.g. tmu-cashloan)" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <input name="namfisa_reg_number" placeholder="NAMFISA registration number" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition">
            Create tenant
          </button>
        </form>
      </div>
    </div>
  );
}
