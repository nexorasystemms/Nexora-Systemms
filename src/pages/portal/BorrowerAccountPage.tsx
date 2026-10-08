import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
import { tmuPortal } from "../../lib/tenants";
import ChangeEmailFlow from "../../components/ChangeEmailFlow";

export default function BorrowerAccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(tmuPortal.login);
        return;
      }
      setEmail(session.user.email || "");
      setLoading(false);
    }
    load();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <Link to={tmuPortal.home} className="text-sm text-secondary hover:underline">← Back to portal</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Account</h1>
        <p className="text-sm text-slate-500 mt-1">Update the email you use to sign in.</p>
      </div>
      <ChangeEmailFlow loginPath={tmuPortal.login} currentEmail={email} />
    </div>
  );
}
