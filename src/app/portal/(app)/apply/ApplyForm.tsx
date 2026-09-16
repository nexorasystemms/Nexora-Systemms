"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startBorrowerApplication, saveBorrowerEmployment, uploadBorrowerDocument, submitBorrowerApplication } from "../../actions";
import { computeDisclosure, type DisclosureParams } from "@/lib/portal";
import { formatNad } from "@/lib/format";
import type { ApplicationRow } from "@/types/database";

const STEPS = ["Loan request", "Employment & income", "Documents & consent"] as const;

export default function ApplyForm({
  disclosureParams,
  draftApplication,
  employmentDone,
  existingDocTypes,
}: {
  disclosureParams: DisclosureParams;
  draftApplication: ApplicationRow | null;
  employmentDone: boolean;
  existingDocTypes: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(draftApplication ? (employmentDone ? 2 : 1) : 0);
  const [applicationId, setApplicationId] = useState<string | null>(draftApplication?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">Cash Loan Application</h1>
        <Steps current={step} />
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-danger px-4 py-3 text-sm">{error}</div>}

      {step === 0 && (
        <LoanRequestStep
          disclosureParams={disclosureParams}
          defaults={draftApplication}
          pending={pending}
          onSubmit={async (formData) => {
            setError(null);
            setPending(true);
            const result = await startBorrowerApplication(formData);
            setPending(false);
            if (result.status === "error") {
              setError(result.message ?? "Could not start your application.");
              return;
            }
            setApplicationId(result.applicationId);
            setStep(1);
          }}
        />
      )}

      {step === 1 && applicationId && (
        <EmploymentStep
          pending={pending}
          onSubmit={async (formData) => {
            setError(null);
            setPending(true);
            const result = await saveBorrowerEmployment(applicationId, formData);
            setPending(false);
            if (result.status === "error") {
              setError(result.message ?? "Could not save your employment details.");
              return;
            }
            setStep(2);
          }}
        />
      )}

      {step === 2 && applicationId && (
        <DocumentsAndConsentStep
          applicationId={applicationId}
          existingDocTypes={existingDocTypes}
          pending={pending}
          setPending={setPending}
          setError={setError}
          onSubmitted={() => router.push("/portal")}
        />
      )}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-brand-muted">
      {STEPS.map((label, i) => (
        <span key={label} className={i === current ? "text-brand-navy font-medium" : ""}>
          {i > 0 && <span className="mx-2 text-brand-border">→</span>}
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — statutory disclosure gate: the borrower sees the exact finance-charge cap and
// total repayable before entering any personal detail, per the Microlending Act 7 of 2018's
// transparency requirements.
// ---------------------------------------------------------------------------

function LoanRequestStep({
  disclosureParams, defaults, pending, onSubmit,
}: {
  disclosureParams: DisclosureParams;
  defaults: ApplicationRow | null;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [amount, setAmount] = useState(defaults?.amount_requested ?? 2000);
  const [term, setTerm] = useState(defaults?.term_months ?? 1);
  const [productType, setProductType] = useState<"once_off" | "instalment">(defaults?.product_type ?? "once_off");

  const ceiling = disclosureParams.loan_ceiling_nad ?? 25000;
  const termCeiling = disclosureParams.term_ceiling_months ?? 60;
  const onceOffMaxTerm = Math.min(termCeiling, disclosureParams.finance_charge_cap_short_term_months ?? 5);
  const maxTerm = productType === "once_off" ? onceOffMaxTerm : termCeiling;
  const disclosure = computeDisclosure(amount, term, disclosureParams);

  function selectProductType(v: "once_off" | "instalment") {
    setProductType(v);
    if (v === "once_off" && term > onceOffMaxTerm) setTerm(onceOffMaxTerm);
  }

  return (
    <form
      action={(formData) => {
        formData.set("amount_requested", String(amount));
        formData.set("term_months", String(term));
        formData.set("product_type", productType);
        onSubmit(formData);
      }}
      className="space-y-6"
    >
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-brand-navy">Loan request</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Product</label>
          <div className="flex gap-2">
            {(["once_off", "instalment"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => selectProductType(v)}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  productType === v ? "bg-brand-navy text-white border-brand-navy" : "border-brand-border text-brand-muted"
                }`}
              >
                {v === "once_off" ? "Once-off (payday)" : "Monthly instalments"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="amount">
            Amount requested — {formatNad(amount)}
          </label>
          <input
            id="amount"
            type="range"
            min={500}
            max={Math.min(ceiling, 25000)}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="term">
            Term — {term} month{term === 1 ? "" : "s"}
          </label>
          <input
            id="term"
            type="range"
            min={1}
            max={maxTerm}
            step={1}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {productType === "once_off" && (
          <Field label="Next pay date (your repayment date)" name="next_pay_date" type="date" required defaultValue={defaults?.next_pay_date ?? ""} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Purpose"
            name="purpose_category"
            defaultValue={defaults?.purpose_category ?? ""}
            options={[
              ["emergency", "Emergency expense"],
              ["household", "Household / groceries"],
              ["medical", "Medical"],
              ["education", "Education"],
              ["other", "Other"],
            ]}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-2 text-sm">
        <h3 className="font-semibold text-brand-navy">What this will cost you</h3>
        <Row label="Finance charge" value={formatNad(disclosure.financeCharge)} />
        <Row label="Total repayable" value={formatNad(disclosure.totalRepayable)} />
        <Row label={productType === "once_off" ? "Repayment due" : "Monthly instalment"} value={formatNad(disclosure.instalment)} />
        <p className="text-xs text-brand-muted pt-2">
          Capped by law at {((disclosureParams.finance_charge_cap_short_pct ?? 0.3) * 100).toFixed(0)}% of principal for
          short-term loans ({disclosureParams.finance_charge_cap_short_term_months ?? 5} months or less). TMU CashLoan CC
          charges zero initiation, admin, or insurance fees beyond this finance charge.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Employment & net income (feeds the staff-side A-E-S affordability engine once
// the application reaches assessment; borrowers don't see or influence that computation).
// ---------------------------------------------------------------------------

function EmploymentStep({ pending, onSubmit }: { pending: boolean; onSubmit: (formData: FormData) => void }) {
  return (
    <form
      action={(formData) => onSubmit(formData)}
      className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4"
    >
      <h2 className="text-sm font-semibold text-brand-navy">Employment & income</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Employer name" name="employer_name" required />
        <Field label="Occupation" name="occupation" />
        <Field label="Monthly net (take-home) salary" name="monthly_net_salary" type="number" required />
        <Field label="Employment start date" name="employment_start_date" type="date" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — document evidence + the five unbundled statutory consents (FR-CONSENT-01).
// ---------------------------------------------------------------------------

function DocumentsAndConsentStep({
  applicationId, existingDocTypes, pending, setPending, setError, onSubmitted,
}: {
  applicationId: string;
  existingDocTypes: string[];
  pending: boolean;
  setPending: (v: boolean) => void;
  setError: (v: string | null) => void;
  onSubmitted: () => void;
}) {
  const [payslipAvailable, setPayslipAvailable] = useState(true);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set(existingDocTypes));
  const idRef = useRef<HTMLInputElement>(null);
  const incomeRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);

  const incomeDocType = payslipAvailable ? "payslip" : "alternative_income_evidence";
  const requiredTypes = ["id", incomeDocType, "bank_statement"];
  const allUploaded = requiredTypes.every((t) => uploaded.has(t));

  async function handleUpload(docType: string, input: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("doc_type", docType);
    fd.set("file", file);
    const result = await uploadBorrowerDocument(applicationId, fd);
    setPending(false);
    if (result.status === "error") {
      setError(result.message ?? "Could not upload this document.");
      return;
    }
    setUploaded((prev) => new Set(prev).add(docType));
  }

  async function handleSubmit(formData: FormData) {
    if (!allUploaded) {
      setError("Please upload all required documents before submitting.");
      return;
    }
    setError(null);
    setPending(true);
    const result = await submitBorrowerApplication(applicationId, formData);
    setPending(false);
    if (result.status === "error") {
      setError(result.message ?? "Could not submit your application.");
      return;
    }
    onSubmitted();
  }

  return (
    <div className="space-y-6">
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-brand-navy">Documents</h2>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!payslipAvailable} onChange={(e) => setPayslipAvailable(!e.target.checked)} />
          I don&apos;t have a recent payslip
        </label>

        <DocUpload label="National ID / Passport" done={uploaded.has("id")} inputRef={idRef} onUpload={() => handleUpload("id", idRef.current)} />
        <DocUpload
          label={payslipAvailable ? "Latest payslip" : "Alternative income evidence"}
          done={uploaded.has(incomeDocType)}
          inputRef={incomeRef}
          onUpload={() => handleUpload(incomeDocType, incomeRef.current)}
        />
        <DocUpload label="3-month bank statement" done={uploaded.has("bank_statement")} inputRef={bankRef} onUpload={() => handleUpload("bank_statement", bankRef.current)} />
      </div>

      <form action={handleSubmit} className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-brand-navy">Consent to proceed</h2>
        <Consent name="consent_credit_assessment" label="I consent to TMU CashLoan CC assessing my creditworthiness using the information provided." required />
        <Consent name="consent_bureau_enquiry_and_submission" label="I consent to a credit bureau enquiry and to my repayment history being submitted to a credit bureau." required />
        <Consent name="consent_debt_collection_disclosure" label="I acknowledge the debt collection process disclosure for late or missed payments." required />
        <Consent name="consent_cession_disclosure" label="I acknowledge the cession/assignment disclosure for this loan agreement." required />
        <Consent name="consent_marketing" label="I'd like to receive marketing communications (optional)." />

        <button
          type="submit"
          disabled={pending || !allUploaded}
          className="rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}

function DocUpload({
  label, done, inputRef, onUpload,
}: { label: string; done: boolean; inputRef: React.RefObject<HTMLInputElement | null>; onUpload: () => void }) {
  return (
    <div className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
      <span className="font-medium">{label}</span>
      {done ? (
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Uploaded</span>
      ) : (
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="text-xs" />
          <button type="button" onClick={onUpload} className="text-xs text-brand-blue hover:underline">Upload</button>
        </div>
      )}
    </div>
  );
}

function Consent({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} required={required} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Field({
  label, name, type = "text", required, defaultValue,
}: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={name}>
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
      />
    </div>
  );
}

function Select({
  label, name, options, defaultValue,
}: { label: string; name: string; options: [string, string][]; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue || ""}
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
      >
        <option value="">Select…</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
