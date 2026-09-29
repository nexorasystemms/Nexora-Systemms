import { useDashboardAuth } from "../../lib/useDashboardAuth";
import DashboardPageShell, { PageLoader, ComingSoonCard } from "../../components/DashboardPageShell";

export default function PolicyParamsPage() {
  const { user, loading } = useDashboardAuth(["admin", "super_admin"]);
  if (loading) return <PageLoader label="Loading policy parameters…" />;
  if (!user) return null;

  return (
    <DashboardPageShell
      title="Policy Parameters"
      subtitle="Configure lending policy rules, rate caps, DSR thresholds, and pilot volume limits."
      icon="tune"
      badge="Admin Only"
    >
      <ComingSoonCard feature="Policy parameter configuration" />
    </DashboardPageShell>
  );
}
