import { useState } from "react";
import type { LoanProduct } from "../../lib/loan-products";
import { extractDocument, type FormFields } from "../../lib/nexora";

type Status =
  | { state: "reading" }
  | { state: "done"; filled: string[]; warning?: string }
  | { state: "error"; message: string };

const FIELD_LABELS: Record<keyof FormFields, string> = {
  employerName: "employer",
  employerAddress: "employer address",
  occupation: "occupation",
  monthlyNetSalary: "net salary",
  grossSalary: "gross salary",
  employmentStartDate: "employment date",
  bankName: "bank",
  accountName: "account name",
  bankBranch: "branch",
  accountNumber: "account number",
  businessName: "business name",
  tenderReference: "tender / P.O. reference",
};

// Optional helper on the apply form: documents chosen here are kept for the Documents step
// and Nexora reads them to pre-fill the form. Borrowers can still edit every field.
export default function DocumentAutofill({
  product,
  files,
  onFile,
  onFill,
}: {
  product: LoanProduct;
  files: Record<string, File | null>;
  onFile: (key: string, file: File | null) => void;
  onFill: (fields: FormFields) => void;
}) {
  const [status, setStatus] = useState<Record<string, Status>>({});

  async function handleChoose(key: string, file: File | null) {
    onFile(key, file);
    if (!file) {
      setStatus(({ [key]: _removed, ...rest }) => rest);
      return;
    }
    setStatus((s) => ({ ...s, [key]: { state: "reading" } }));
    try {
      const result = await extractDocument(key, file);
      const entries = Object.entries(result.formFields) as [keyof FormFields, unknown][];
      if (entries.length) onFill(result.formFields);
      setStatus((s) => ({
        ...s,
        [key]: {
          state: "done",
          filled: entries.map(([k]) => FIELD_LABELS[k] ?? k),
          warning: result.looksLikeExpectedDocument
            ? undefined
            : "This doesn't look like the requested document — please check you chose the right file.",
        },
      }));
    } catch (err) {
      setStatus((s) => ({ ...s, [key]: { state: "error", message: err instanceof Error ? err.message : "Could not read this document." } }));
    }
  }

  return (
    <div className="p-4 rounded-xl border border-secondary/30 bg-secondary-container/20 space-y-3">
      <div>
        <p className="text-xs font-bold text-slate-800">Save time: upload your documents to fill this form automatically (optional)</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          We read your documents and fill in what we can. Check everything before you continue — you can change any field.
          The files you pick here are reused in the Documents step.
        </p>
      </div>
      {product.documents.map((doc) => {
        const s = status[doc.key];
        return (
          <div key={doc.key} className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">{doc.label}</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleChoose(doc.key, e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
            />
            {files[doc.key] && !s && <p className="text-[11px] text-slate-500 mt-1">Selected: {files[doc.key]?.name}</p>}
            {s?.state === "reading" && <p className="text-[11px] text-slate-500 mt-1">Reading your document…</p>}
            {s?.state === "done" && (
              <p className="text-[11px] text-secondary mt-1">
                {s.filled.length ? `Filled in: ${s.filled.join(", ")}.` : "Nothing to fill from this document."}
                {s.warning && <span className="block text-amber-700">{s.warning}</span>}
              </p>
            )}
            {s?.state === "error" && <p className="text-[11px] text-amber-700 mt-1">{s.message}</p>}
          </div>
        );
      })}
    </div>
  );
}
