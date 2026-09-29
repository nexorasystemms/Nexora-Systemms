import { useDashboardAuth } from "../../lib/useDashboardAuth";
import DashboardPageShell, { PageLoader, ComingSoonCard } from "../../components/DashboardPageShell";

export default function TenantsPage() {
  const { user, loading } = useDashboardAuth(["super_admin"]);
  if (loading) return <PageLoader label="Loading tenants…" />;
  if (!user) return null;

  return (
    <DashboardPageShell
      title="Tenants"
      subtitle="Manage tenant organisations, NAMFISA registration numbers, and per-tenant configuration."
      icon="domain"
      badge="Super Admin"
    >
      <ComingSoonCard feature="Tenant management" />
    </DashboardPageShell>
  );
}
