"use client";

import { useState, useTransition } from "react";
import type { DocumentRow } from "@/types/database";
import { borrowerUploadDocument } from "./actions";

const DOC_TYPES: [string, string][] = [
  ["id", "National ID / Passport"],
  ["payslip", "Latest Payslip"],
  ["alternative_income_evidence", "Alternative Income Evidence"],
  ["bank_statement", "3-Month Bank Statement"],
  ["proof_of_address", "Proof of Address"],
];

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  pending: { bg: "bg-amber-100 text-amber-800 border-amber-200", label: "Under Review" },
  reviewed_accepted: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Verified & Accepted" },
  rejected: { bg: "bg-red-100 text-red-800 border-red-200", label: "Needs Replacement" },
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Application Documents</h3>
        <p className="text-xs text-slate-500">
          Required verification documents for your loan application.
        </p>
      </div>

      {/* List of uploaded documents */}
      <div className="space-y-3 mb-6">
        {documents.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No documents uploaded yet. Use the form below to upload your documents.
          </div>
        ) : (
          documents.map((doc) => {
            const meta = STATUS_STYLE[doc.status] ?? STATUS_STYLE.pending;
            const typeLabel = DOC_TYPES.find(([v]) => v === doc.doc_type)?.[1] ?? doc.doc_type;

            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{typeLabel}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${meta.bg}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Uploaded {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                  {doc.review_notes && doc.status === "rejected" && (
                    <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                      <strong>Officer Note:</strong> {doc.review_notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload Box */}
      {canUpload && (
        <div className="pt-5 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Upload or Replace a Document
          </h4>

          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              Document uploaded successfully! Our loan officers will review it shortly.
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Type
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white"
                >
                  {DOC_TYPES.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Photo or PDF
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pending || !file}
              className="px-4 py-2 bg-brand-navy hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {pending ? "Uploading..." : "Upload Document"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
