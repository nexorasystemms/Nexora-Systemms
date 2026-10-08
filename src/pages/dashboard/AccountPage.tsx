import { useAuth } from "@/contexts/AuthContext";
import ChangeEmailFlow from "@/components/ChangeEmailFlow";

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Account</h1>
        <p className="text-sm text-on-surface-variant mt-1">Update the email you use to sign in to the staff console.</p>
      </div>
      <ChangeEmailFlow loginPath="/login" currentEmail={user?.email} />
    </div>
  );
}
