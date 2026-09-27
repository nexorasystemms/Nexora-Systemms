"use client";

import { signOut } from "@/lib/supabase/auth";

export default function SignOutButton() {
  async function handleSignOut() {
    await signOut();
    window.location.href = '/portal/login';
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