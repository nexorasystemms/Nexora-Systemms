import { useNavigate } from "react-router-dom";
import { signOut } from "../../lib/supabase/auth";

export default function SignOutButton() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/portal/login');
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-slate-600 hover:text-slate-900 transition"
    >
      Sign out
    </button>
  );
}
