"use client";

import { useState, useTransition } from "react";
import { uploadDocument, reviewDocument, getDocumentSignedUrl } from "./actions";
import type { DocumentRow, StaffRole } from "@/types/database";
import { canReviewDocuments } from "@/lib/roles";

const DOC_TYPES: [string, string][] = [
  ["id", "ID document"],
  ["payslip", "Payslip"],
  ["alternative_income_evidence", "Alternative income evidence (no payslip)"],
  ["bank_statement", "Bank statement"],
  ["proof_of_address", "Proof of address"],
  ["spouse_id", "Spouse ID (married in COP)"],
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed_accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function DocumentsSection({
  applicationId, documents, role, payslipAvailable,
}: { applicationId: string; documents: DocumentRow[]; role: StaffRole; payslipAvailable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const requiredTypes = payslipAvailable
    ? ["id", "payslip", "bank_statement"]
    : ["id", "alternative_income_evidence", "bank_statement"];

  async function handlePreview(path: string) {
    const url = await getDocumentSignedUrl(path);
    setPreviewUrl(url);
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-brand-navy mb-1">Documents</h2>
      <p className="text-xs text-brand-muted mb-4">
        Required for this application: {requiredTypes.map((t) => DOC_TYPES.find(([v]) => v === t)?.[1]).join(", ")}.
        No AI extraction runs in the pilot — staff view and key figures manually (§4.2).
      </p>

      <div className="space-y-2 mb-4">
        {DOC_TYPES.map(([type, label]) => {
          const doc = documents.filter((d) => d.doc_type === type).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const required = requiredTypes.includes(type);
          if (!doc && !required) return null;
          return (
            <div key={type} className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={required ? "font-medium" : ""}>{label}</span>
                {required && <span className="text-[10px] text-danger">required</span>}
              </div>
              {doc ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePreview(doc.file_path)} className="text-brand-blue text-xs hover:underline">View</button>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[doc.status]}`}>{doc.status.replace("_", " ")}</span>
                  {canReviewDocuments(role) && doc.status === "pending" && (
                    <>
                      <button
                        onClick={() => startTransition(() => reviewDocument(applicationId, doc.id, "reviewed_accepted", ""))}
                        className="text-xs text-success hover:underline"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt("Rejection reason?") ?? "";
                          startTransition(() => reviewDocument(applicationId, doc.id, "rejected", reason));
                        }}
                        className="text-xs text-danger hover:underline"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-xs text-brand-muted">Not uploaded</span>
              )}
            </div>
          );
        })}
      </div>

      <form
        action={(fd) => startTransition(() => uploadDocument(applicationId, fd))}
        className="flex flex-wrap items-end gap-3 border-t border-brand-border pt-4"
      >
        <div>
          <label className="block text-xs font-medium mb-1">Document type</label>
          <select name="doc_type" required defaultValue="" className="rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
            <option value="" disabled>Select…</option>
            {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">File</label>
          <input type="file" name="file" required accept="image/*,application/pdf" className="text-sm" />
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-lg w-full max-w-3xl h-[85vh] overflow-auto p-2 flex flex-col" onClick={(e) => e.stopPropagation()}>
            {previewUrl.includes(".pdf") ? (
              <iframe src={previewUrl} className="flex-1 w-full" title="Document preview" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Document preview" className="max-w-full" />
            )}
            <button onClick={() => setPreviewUrl(null)} className="mt-2 text-sm text-brand-muted hover:text-brand-navy self-start">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
