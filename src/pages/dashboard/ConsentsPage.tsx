import { useDashboardAuth } from "../../lib/useDashboardAuth";
import DashboardPageShell, { PageLoader, ComingSoonCard } from "../../components/DashboardPageShell";

export default function ConsentsPage() {
  const { user, loading } = useDashboardAuth();
  if (loading) return <PageLoader label="Loading consents…" />;
  if (!user) return null;

  return (
    <DashboardPageShell
      title="Consents & KYC"
      subtitle="Statutory consent records and borrower identity verification status."
      icon="verified_user"
      badge="FR-KYC"
    >
      <ComingSoonCard feature="Consents & KYC management" />
    </DashboardPageShell>
  );
}
