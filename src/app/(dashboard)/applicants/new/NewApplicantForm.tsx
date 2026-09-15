"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createApplicant, type ApplicantFormState } from "../actions";

const initialState: ApplicantFormState = { status: "idle" };

export default function NewApplicantForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createApplicant, initialState);

  useEffect(() => {
    if (state.status === "success" && state.applicantId) {
      router.push(`/applicants/${state.applicantId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.status === "duplicate" && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          {state.message}{" "}
          {state.duplicateApplicantId && (
            <a href={`/applicants/${state.duplicateApplicantId}`} className="underline font-medium">
              View existing applicant →
            </a>
          )}
        </div>
      )}
      {state.status === "error" && (
        <div className="rounded-md bg-red-50 border border-red-200 text-danger px-4 py-3 text-sm">
          {state.message}
        </div>
      )}

      <Section title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" name="full_name" required />
          <Select label="Sex" name="sex" options={[["M", "Male"], ["F", "Female"]]} />
          <Select label="ID type" name="id_type" required options={[["personal_id", "Namibian ID"], ["passport", "Passport"]]} />
          <Field label="ID / passport number" name="id_number" required />
          <Field label="Document number (if passport)" name="document_number" />
        </div>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Mobile phone" name="mobile" required placeholder="+264…" />
          <Field label="Email" name="email" type="email" />
          <div className="sm:col-span-2">
            <Field label="Residential address" name="residential_address" required />
          </div>
        </div>
      </Section>

      <Section title="Household">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Marital status"
            name="marital_status"
            required
            options={[
              ["single", "Single"],
              ["married_in_cop", "Married in community of property"],
              ["married_out_of_cop", "Married out of community of property"],
            ]}
          />
          <Field label="Number of dependants" name="dependants_count" type="number" defaultValue="0" required />
        </div>
      </Section>

      <Section title="Next of kin">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" name="next_of_kin_name" required />
          <Field label="Mobile" name="next_of_kin_mobile" required />
        </div>
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create applicant"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-brand-navy mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, name, type = "text", required, placeholder, defaultValue,
}: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
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
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
      />
    </div>
  );
}

function Select({
  label, name, options, required,
}: { label: string; name: string; options: [string, string][]; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={name}>
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
      >
        <option value="" disabled>Select…</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
