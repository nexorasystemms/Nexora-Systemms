"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function BorrowerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    // Verify role in public.users
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("User profile not found. If you are a new applicant, please register first.");
      setLoading(false);
      return;
    }

    if (profile.status !== "active") {
      await supabase.auth.signOut();
      setError("Your account is currently inactive. Please contact TMU CashLoan CC.");
      setLoading(false);
      return;
    }

    if (profile.role !== "borrower") {
      await supabase.auth.signOut();
      setError("Staff members must sign in through the internal staff portal at /login.");
      setLoading(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <Image
          src="/brand/nexora-logo-stacked.png"
          alt="Nexora Systems"
          width={90}
          height={90}
          className="mx-auto mb-3"
          priority
        />
        <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
          Borrower Portal
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Track Your Cash Loan</h1>
        <p className="text-sm text-slate-500 mt-1">
          TMU CashLoan CC · Windhoek, Namibia
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            placeholder="name@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Password
            </label>
          </div>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-brand-navy hover:bg-slate-800 text-white font-medium text-sm transition disabled:opacity-50 shadow-sm"
        >
          {loading ? "Signing in..." : "Sign In to Portal"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-600">
          Applied in person or new to TMU online?{" "}
          <Link href="/portal/register" className="font-semibold text-brand-blue hover:underline">
            Create an Account
          </Link>
        </p>
        <p className="text-[11px] text-slate-400 mt-3">
          Staff member?{" "}
          <Link href="/login" className="text-slate-500 hover:underline">
            Go to Staff Console
          </Link>
        </p>
      </div>
    </div>
  );
}
