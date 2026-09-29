import { useDashboardAuth } from "../../lib/useDashboardAuth";
import DashboardPageShell, { PageLoader, ComingSoonCard } from "../../components/DashboardPageShell";

export default function PilotGuardrailsPage() {
  const { user, loading } = useDashboardAuth(["admin", "super_admin"]);
  if (loading) return <PageLoader label="Loading pilot guardrails…" />;
  if (!user) return null;

  return (
    <DashboardPageShell
      title="Pilot Guardrails"
      subtitle="Set weekly origination volume caps and automatic circuit-breaker thresholds for the pilot programme."
      icon="shield"
      badge="Admin Only"
    >
      <ComingSoonCard feature="Pilot guardrail configuration" />
    </DashboardPageShell>
  );
}
