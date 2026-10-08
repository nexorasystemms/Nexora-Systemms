import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createClient } from "../../lib/supabase/client";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatNad } from "../../lib/format";
import { openDocument, recordStaffDecision, reviewDocument } from "../../lib/supabase/applications";
import { loanProductLabel } from "../../lib/loan-products";
import { DECLINE_REASONS, declineReasonLabel } from "../../lib/decline-reasons";
import { useAuth } from "../../contexts/AuthContext";
import { canDecide, canReviewDocuments } from "../../lib/roles";
import type { StaffRole } from "../../types/database";

const DOC_LABELS: Record<string, string> = {
  id: "National ID / Passport",
  payslip: "Payslip",
  bank_statement: "Bank statement",
  proof_of_address: "Proof of address",
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as StaffRole | undefined;
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any>(null);
  const [applicant, setApplicant] = useState<any>(null);
  const [employment, setEmployment] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [decision, setDecision] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("affordability_not_met");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    const supabase = createClient();
    const { data: application } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
    if (!application) {
      navigate("/dashboard");
      return;
    }
    setApp(application);
    const [{ data: applicantData }, { data: employmentData }, { data: docs }, { data: decisions }] = await Promise.all([
      supabase.from("applicants").select("*").eq("id", application.applicant_id).maybeSingle(),
      supabase.from("employment").select("*").eq("application_id", id).maybeSingle(),
      supabase.from("documents").select("*").eq("entity_type", "application").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.from("decisions").select("*").eq("application_id", id).order("decided_at", { ascending: false }).limit(1),
    ]);
    setApplicant(applicantData);
    setEmployment(employmentData);
    setDocuments(docs || []);
    setDecision(decisions?.[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  async function viewFile(path: string) {
    const result = await openDocument(path);
    if (result.success && result.data?.signedUrl) {
      window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
    } else {
      setError(result.error || "Could not open document");
    }
  }

  async function markDoc(documentId: string, status: "reviewed_accepted" | "rejected") {
    const note = status === "rejected" ? window.prompt("Why does this document need replacement?") || "" : "Accepted";
    const result = await reviewDocument(documentId, status, note);
    if (!result.success) setError(result.error || "Could not update document");
    else await load();
  }

  async function decline() {
    if (!id) return;
    if (!notes.trim()) {
      setError("Add a short explanation the borrower will see.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await recordStaffDecision({
      applicationId: id,
      outcome: "declined",
      reasonCode,
      notes,
    });
    setSaving(false);
    if (!result.success) setError(result.error || "Could not record the decline");
    else await load();
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-on-surface-variant">Loading application…</div>;
  }
  if (!app) return null;

  const canReview = role ? canReviewDocuments(role) : false;
  const canRecordDecision = role ? canDecide(role) : false;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">← Applications</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-on-surface font-mono">{app.reference_number}</h1>
            <p className="text-sm text-on-surface-variant">
              {applicant?.full_name ?? "Applicant"} · {loanProductLabel(app.loan_product, app.product_type)} · {formatNad(app.amount_requested)}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-xs text-red-700">{error}</div>}

      {decision?.outcome === "declined" && (
        <div className="p-4 rounded-xl bg-error-container text-on-error-container">
          <div className="font-semibold">Declined</div>
          <p className="text-sm mt-1">{declineReasonLabel(decision.reason_code)}</p>
          {decision.notes && <p className="text-sm mt-1">{decision.notes}</p>}
          <p className="text-[11px] mt-2 opacity-80">Recorded {formatDate(decision.decided_at)}. The borrower sees this same reason.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="Term" value={`${app.term_months} month(s)`} />
        <Info label="Next pay date" value={app.next_pay_date ? formatDate(app.next_pay_date) : "—"} />
        <Info label="Employer" value={employment?.employer_name ?? "—"} />
        <Info label="Net salary" value={employment?.monthly_net_salary != null ? formatNad(employment.monthly_net_salary) : "—"} />
      </div>

      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-5">
        <h2 className="text-sm font-semibold text-on-surface mb-3">Uploaded documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-surface-container-low">
                <div>
                  <div className="text-sm font-semibold">{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</div>
                  <div className="text-[11px] text-on-surface-variant">
                    {doc.original_filename || doc.file_path} · {formatDate(doc.created_at)} · {doc.status.replaceAll("_", " ")}
                  </div>
                  {doc.review_notes && <div className="text-[12px] mt-1">{doc.review_notes}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => viewFile(doc.file_path)} className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold">
                    View / download
                  </button>
                  {canReview && doc.status === "pending" && (
                    <>
                      <button type="button" onClick={() => markDoc(doc.id, "reviewed_accepted")} className="px-3 py-1.5 rounded border text-xs">Accept</button>
                      <button type="button" onClick={() => markDoc(doc.id, "rejected")} className="px-3 py-1.5 rounded border text-xs text-error">Request replacement</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canRecordDecision && !["declined", "approved", "approved_with_changes", "disbursed", "performing", "settled"].includes(app.status) && (
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-on-surface">Record a decline</h2>
          <p className="text-xs text-on-surface-variant">
            The reason and notes below are shown to the borrower. AI assessment remains a separate step.
          </p>
          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm bg-white">
            {DECLINE_REASONS.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Explain the decision in plain language for the borrower."
            className="w-full px-3 py-2 rounded-lg border text-sm"
          />
          <button type="button" disabled={saving} onClick={decline} className="px-4 py-2 rounded-lg bg-error text-on-error text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Decline application"}
          </button>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
      <div className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}
