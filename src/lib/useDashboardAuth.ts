import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";

type AllowedRole = "admin" | "super_admin" | "intake" | "officer" | "approver" | "finance";

interface DashboardAuthState {
  user: any | null;
  loading: boolean;
}

/**
 * Guards a dashboard page: checks Supabase session and staff role,
 * redirects to /login if either check fails.
 * Optional `allowedRoles` subset for additional role-gating.
 */
export function useDashboardAuth(allowedRoles?: AllowedRole[]): DashboardAuthState {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function check() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }

        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (!userData || userData.role === "borrower") { navigate("/login"); return; }

        if (allowedRoles && !allowedRoles.includes(userData.role)) {
          navigate("/dashboard"); return;
        }

        setUser(userData);
      } catch (e) {
        console.error("Dashboard auth check failed:", e);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
