"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaSetupForm() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Guards against React Strict Mode's double-invoked effect in dev, which otherwise fires
  // enroll() twice and collides on the default empty friendly name.
  const enrollStarted = useRef(false);

  useEffect(() => {
    if (enrollStarted.current) return;
    enrollStarted.current = true;

    async function enroll() {
      const supabase = createClient();

      // Clear out any unverified factor left over from an earlier abandoned attempt —
      // Supabase rejects a new enroll() with a duplicate-friendly-name error otherwise.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp.filter((f) => f.status === "unverified") ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `staff-totp-${Date.now()}`,
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    enroll();
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not start MFA challenge");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    await supabase.from("users").update({ mfa_enrolled: true }).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");

    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-xl shadow-sm p-8">
      <h1 className="text-lg font-semibold text-brand-navy mb-1">Set up multi-factor authentication</h1>
      <p className="text-sm text-brand-muted mb-4">
        MFA is mandatory for every staff account, including the tenant owner (FR-CORE-03). Scan this
        code with an authenticator app (Google Authenticator, Authy, 1Password).
      </p>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {qrCode ? (
        <div className="flex flex-col items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="MFA QR code" width={180} height={180} />
          {secret && <p className="text-xs text-brand-muted break-all text-center">Manual entry key: {secret}</p>}
        </div>
      ) : (
        <p className="text-sm text-brand-muted mb-4">Generating your setup code…</p>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          className="w-full rounded-md border border-brand-border px-3 py-2 text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        <button
          type="submit"
          disabled={loading || !factorId}
          className="w-full rounded-md bg-brand-navy text-white py-2 text-sm font-medium hover:bg-brand-navy-light transition disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Confirm & continue"}
        </button>
      </form>
    </div>
  );
}
