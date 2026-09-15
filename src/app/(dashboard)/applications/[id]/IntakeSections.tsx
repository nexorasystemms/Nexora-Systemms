"use client";

import { useState, useTransition } from "react";
import {
  saveEmployment, addCreditHistoryRow, removeCreditHistoryRow, saveBankDetails,
  saveIncomeExpenditure, saveConsents, transitionApplication,
} from "./actions";
import { EXPENDITURE_LINE_CODES } from "@/lib/rules-engine/engine";
import type { EmploymentRow, CreditHistoryRow, BankDetailsRow, IncomeExpenditureRow, ConsentRow, ApplicationStatus } from "@/types/database";
import { formatNad } from "@/lib/format";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-brand-navy mb-4">{title}</h2>
      {children}
    </div>
  );
}

function TextInput({ label, name, defaultValue, type = "text", required }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}{required && <span className="text-danger"> *</span>}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
      />
    </div>
  );
}

export function EmploymentSection({ applicationId, employment, disabled }: { applicationId: string; employment: EmploymentRow | null; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Card title="Employment">
      <form
        action={(fd) => startTransition(() => saveEmployment(applicationId, fd))}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <TextInput label="Employer name" name="employer_name" defaultValue={employment?.employer_name} required />
        <TextInput label="Occupation" name="occupation" defaultValue={employment?.occupation} />
        <TextInput label="Employer address" name="employer_address" defaultValue={employment?.employer_address} />
        <TextInput label="Monthly net salary" name="monthly_net_salary" type="number" defaultValue={employment?.monthly_net_salary} />
        <TextInput label="Employment start date" name="employment_start_date" type="date" defaultValue={employment?.employment_start_date} />
        <TextInput label="Employer phone" name="employer_phone" defaultValue={employment?.employer_phone} />
        <TextInput label="Employer contact person" name="employer_contact" defaultValue={employment?.employer_contact} />
        <TextInput label="Employer email" name="employer_email" type="email" defaultValue={employment?.employer_email} />
        <div className="sm:col-span-2">
          <button type="submit" disabled={disabled || pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
            {pending ? "Saving…" : "Save employment"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function CreditHistorySection({ applicationId, rows, disabled }: { applicationId: string; rows: CreditHistoryRow[]; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Card title="Prior / Other Credit Obligations">
      <div className="space-y-2 mb-4">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
            <span>{r.lender_name} — {formatNad(r.monthly_instalment)}/mo</span>
            <button
              onClick={() => startTransition(() => removeCreditHistoryRow(applicationId, r.id))}
              disabled={disabled}
              className="text-xs text-danger hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-brand-muted">No obligations declared.</p>}
      </div>
      <form action={(fd) => startTransition(() => addCreditHistoryRow(applicationId, fd))} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <TextInput label="Lender" name="lender_name" required />
        <TextInput label="Monthly instalment" name="monthly_instalment" type="number" required />
        <TextInput label="Outstanding" name="amount_outstanding" type="number" />
        <TextInput label="Full-repayment date" name="expected_repayment_date" type="date" />
        <div className="sm:col-span-4">
          <button type="submit" disabled={disabled || pending} className="rounded-md border border-brand-navy text-brand-navy text-sm font-medium px-4 py-2 hover:bg-brand-navy hover:text-white transition disabled:opacity-50">
            + Add obligation
          </button>
        </div>
      </form>
    </Card>
  );
}

export function BankDetailsSection({ applicationId, bankDetails, disabled }: { applicationId: string; bankDetails: BankDetailsRow | null; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const NAMIBIAN_BANKS = ["Bank Windhoek", "First National Bank Namibia", "Standard Bank Namibia", "Nedbank Namibia", "Letshego Bank Namibia"];
  return (
    <Card title="Bank Details (collection account)">
      <form action={(fd) => startTransition(() => saveBankDetails(applicationId, fd))} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Bank *</label>
          <select name="bank_name" required defaultValue={bankDetails?.bank_name ?? ""} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
            <option value="" disabled>Select…</option>
            {NAMIBIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <TextInput label="Account name" name="account_name" defaultValue={bankDetails?.account_name} required />
        <TextInput label="Branch" name="branch" defaultValue={bankDetails?.branch} />
        <TextInput label="Account number" name="account_number" required />
        <div className="sm:col-span-2">
          <p className="text-xs text-brand-muted mb-2">Account number is tokenised on save and never shown in full outside approver/finance (NFR-SEC-01).</p>
          <button type="submit" disabled={disabled || pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
            {pending ? "Saving…" : "Save bank details"}
          </button>
        </div>
      </form>
    </Card>
  );
}

const INCOME_LINES: [string, string][] = [
  ["INC_BASIC", "Basic salary"], ["INC_BENEFITS", "Benefits"], ["INC_RENTAL", "Rental income"],
  ["INC_DEDUCT", "Less: payslip deductions"],
];
const SPOUSE_LINES: [string, string][] = [["INC_SPOUSE_GROSS", "Spouse gross salary"], ["INC_SPOUSE_DEDUCT", "Spouse deductions"]];
const EXP_LABELS: Record<string, string> = {
  EXP_HOUSING: "Mortgage / rent", EXP_UTILITIES: "Utilities", EXP_VEHICLE_INSTALMENT: "Vehicle instalment",
  EXP_VEHICLE_RUNNING: "Vehicle running costs", EXP_EDUCATION: "Education", EXP_CLOTHING: "Clothing",
  EXP_FOOD: "Food", EXP_TELECOM: "Telecom", EXP_SUBSCRIPTIONS: "Subscriptions", EXP_SECURITY: "Security",
  EXP_HOUSEKEEPING: "Housekeeping", EXP_ASSET_INSURANCE: "Asset insurance",
  EXP_LIFE_FUNERAL_RETIREMENT: "Life / funeral / retirement", EXP_RETAIL_CREDIT: "Retail credit", EXP_OTHER: "Other",
};

export function IncomeExpenditureSection({
  applicationId, lines, marriedInCop, disabled,
}: { applicationId: string; lines: IncomeExpenditureRow[]; marriedInCop: boolean; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const initial: Record<string, number> = {};
  for (const l of lines) initial[l.line_code] = Number(l.amount);
  const [values, setValues] = useState<Record<string, number>>(initial);

  const A = (values.INC_BASIC ?? 0) + (values.INC_BENEFITS ?? 0) + (values.INC_RENTAL ?? 0) - (values.INC_DEDUCT ?? 0);
  const B = marriedInCop ? (values.INC_SPOUSE_GROSS ?? 0) - (values.INC_SPOUSE_DEDUCT ?? 0) : 0;
  const C = values.INC_OTHER ?? 0;
  const D = A + B + C;
  const E = EXPENDITURE_LINE_CODES.reduce((sum, code) => sum + (values[code] ?? 0), 0);
  const S = D - E;

  function onChange(code: string, v: string) {
    setValues((prev) => ({ ...prev, [code]: Number(v) || 0 }));
  }

  return (
    <Card title="Income & Expenditure">
      <form action={(fd) => startTransition(() => saveIncomeExpenditure(applicationId, fd))} className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-brand-muted uppercase mb-2">Income</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INCOME_LINES.map(([code, label]) => (
              <LineInput key={code} code={code} label={label} value={values[code]} onChange={onChange} />
            ))}
            {marriedInCop && SPOUSE_LINES.map(([code, label]) => (
              <LineInput key={code} code={code} label={label} value={values[code]} onChange={onChange} />
            ))}
            <LineInput code="INC_OTHER" label="Other income (net)" value={values.INC_OTHER} onChange={onChange} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-brand-muted uppercase mb-2">Expenditure (17 lines)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EXPENDITURE_LINE_CODES.map((code) => (
              <LineInput key={code} code={code} label={EXP_LABELS[code]} value={values[code]} onChange={onChange} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 bg-gray-50 rounded-md p-3 text-sm">
          <Figure label="A" value={A} />
          <Figure label="B" value={B} />
          <Figure label="C" value={C} />
          <Figure label="D (income)" value={D} strong />
          <Figure label="E (expenditure)" value={E} strong />
          <Figure label="S (surplus)" value={S} strong tone={S > 0 ? "success" : "danger"} />
        </div>

        <button type="submit" disabled={disabled || pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
          {pending ? "Saving…" : "Save income & expenditure"}
        </button>
      </form>
    </Card>
  );
}

function LineInput({ code, label, value, onChange }: { code: string; label: string; value: number | undefined; onChange: (code: string, v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-brand-muted mb-1">{label}</label>
      <input
        name={code}
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(e) => onChange(code, e.target.value)}
        className="w-full rounded-md border border-brand-border px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function Figure({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "success" | "danger" }) {
  return (
    <div>
      <div className="text-[11px] text-brand-muted">{label}</div>
      <div className={`${strong ? "font-semibold" : ""} ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}>
        {formatNad(value)}
      </div>
    </div>
  );
}

export function ConsentsSection({ applicantId, applicationId, existing, disabled }: { applicantId: string; applicationId: string; existing: ConsentRow[]; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const CONSENTS: [string, string][] = [
    ["credit_assessment", "Processing personal/financial data to assess the application"],
    ["bureau_enquiry_and_submission", "Checking credit history with bureaus and submitting performance data"],
    ["debt_collection_disclosure", "Disclosure to collectors/attorneys on default"],
    ["marketing", "Future offers and promotions"],
    ["cession_disclosure", "Disclosure to a third party acquiring rights under the agreement"],
  ];
  const latestByType = new Map<string, ConsentRow>();
  for (const c of existing) if (!latestByType.has(c.consent_type)) latestByType.set(c.consent_type, c);

  return (
    <Card title="Consent (unbundled — each recorded separately)">
      <form action={(fd) => startTransition(() => saveConsents(applicantId, applicationId, fd))} className="space-y-3">
        {CONSENTS.map(([type, label]) => (
          <label key={type} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name={`consent_${type}`}
              defaultChecked={latestByType.get(type)?.granted ?? (type !== "marketing" ? false : false)}
              className="mt-0.5"
            />
            <span>{label}{type === "marketing" && <span className="text-brand-muted"> (opt-in only, defaults unchecked)</span>}</span>
          </label>
        ))}
        <button type="submit" disabled={disabled || pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
          {pending ? "Saving…" : "Save consents"}
        </button>
      </form>
    </Card>
  );
}

export function StatusActions({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) {
  const [pending, startTransition] = useTransition();

  const transitions: Partial<Record<ApplicationStatus, { to: ApplicationStatus; label: string }[]>> = {
    draft: [{ to: "submitted", label: "Mark intake complete → Submitted" }],
    submitted: [{ to: "under_review", label: "Start review → Under Review" }],
    under_review: [{ to: "awaiting_documents", label: "Flag missing documents" }],
    awaiting_documents: [{ to: "under_review", label: "Documents received → back to review" }],
  };
  const options = transitions[status] ?? [];
  if (!options.length) return null;

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.to}
          onClick={() => startTransition(() => transitionApplication(applicationId, opt.to))}
          disabled={pending}
          className="rounded-md border border-brand-navy text-brand-navy text-sm font-medium px-4 py-2 hover:bg-brand-navy hover:text-white transition disabled:opacity-50"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
