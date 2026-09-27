import { useState, useTransition } from "react";
import type { DocumentRow } from "../../types/database";
import { borrowerUploadDocument } from "../../lib/supabase/stubs";

const DOC_TYPES: [string, string][] = [
  ["id", "National ID / Passport"],
  ["payslip", "Latest Payslip"],
  ["alternative_income_evidence", "Alternative Income Evidence"],
  ["bank_statement", "3-Month Bank Statement"],
  ["proof_of_address", "Proof of Address"],
];

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  pending: { bg: "bg-secondary-container text-on-secondary-container", label: "Under Review" },
  reviewed_accepted: { bg: "bg-tertiary-fixed/40 text-tertiary-container", label: "Verified & Accepted" },
  rejected: { bg: "bg-error-container text-on-error-container", label: "Needs Replacement" },
};

export default function BorrowerDocumentsCard({
  applicationId,
  documents,
  canUpload = true,
}: {
  applicationId: string;
  documents: DocumentRow[];
  canUpload?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [docType, setDocType] = useState("payslip");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("doc_type", docType);

    startTransition(async () => {
      try {
        await borrowerUploadDocument(applicationId, formData);
        setSuccess(true);
        setFile(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload document");
      }
    });
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="mb-space-md">
        <h3 className="text-base font-bold text-on-surface">Application Documents</h3>
        <p className="text-[12px] text-on-surface-variant">Required verification documents for your loan application.</p>
      </div>

      <div className="space-y-space-sm mb-space-lg">
        {documents.length === 0 ? (
          <div className="text-[12px] text-on-surface-variant py-space-md text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50">
            No documents uploaded yet. Use the form below to upload your documents.
          </div>
        ) : (
          documents.map((doc) => {
            const meta = STATUS_STYLE[doc.status] ?? STATUS_STYLE.pending;
            const typeLabel = DOC_TYPES.find(([v]) => v === doc.doc_type)?.[1] ?? doc.doc_type;
            return (
              <div key={doc.id} className="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div>
                  <div className="flex items-center gap-space-sm">
                    <span className="text-sm font-semibold text-on-surface">{typeLabel}</span>
                    <span className={`text-[11px] px-space-sm py-0.5 rounded-full font-medium ${meta.bg}`}>{meta.label}</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-0.5">Uploaded {new Date(doc.created_at).toLocaleDateString()}</div>
                  {doc.review_notes && doc.status === "rejected" && (
                    <div className="mt-1 text-[12px] text-on-error-container bg-error-container p-space-xs rounded-md">
                      <strong>Officer Note:</strong> {doc.review_notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {canUpload && (
        <div className="pt-space-lg border-t border-outline-variant/30">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-space-sm">Upload or Replace a Document</h4>

          {error && <div className="mb-space-sm p-space-sm bg-error-container rounded-lg text-[12px] text-on-error-container">{error}</div>}
          {success && (
            <div className="mb-space-sm p-space-sm bg-tertiary-fixed/30 rounded-lg text-[12px] text-tertiary-container">
              Document uploaded successfully! Our loan officers will review it shortly.
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-space-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-space-sm py-2 rounded-lg bg-surface-container-low text-[12px] focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {DOC_TYPES.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-on-surface mb-1">Select Photo or PDF</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-[12px] text-on-surface-variant file:mr-2 file:py-1.5 file:px-space-sm file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-surface-container-high file:text-on-surface"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={pending || !file}
              className="px-space-md py-2 bg-primary text-on-primary rounded-lg text-[12px] font-semibold transition disabled:opacity-50 hover:opacity-90"
            >
              {pending ? "Uploading..." : "Upload Document"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
