"use client";

import { useActionState } from "react";
import { createApplication, type NewApplicationState } from "../actions";

const initialState: NewApplicationState = { status: "idle" };

export default function NewApplicationForm({ applicantId, applicantName }: { applicantId: string; applicantName: string }) {
  const [state, formAction, pending] = useActionState(createApplication, initialState);

  return (
    <form id="new-application-form" action={formAction} className="max-w-2xl space-y-6">
      <input type="hidden" name="applicant_id" value={applicantId} />

      {state.status === "error" && (
        <div className="rounded-md bg-red-50 border border-red-200 text-danger px-4 py-3 text-sm space-y-2">
          <p>{state.message}</p>
          {state.message?.includes("R-15") && (
            <div>
              <label className="block text-xs font-medium mb-1">Override reason (compliance/admin only)</label>
              <input
                name="duplicate_override_reason"
                form="new-application-form"
                className="w-full rounded-md border border-brand-border px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-brand-navy mb-1">Applicant</h2>
        <p className="text-sm text-brand-muted mb-4">{applicantName}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount requested (NAD) *</label>
            <input name="amount_requested" type="number" step="0.01" min="1" max="100000" required
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Loan duration (months) *</label>
            <input name="term_months" type="number" min="1" max="60" required defaultValue="1"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product type *</label>
            <select name="product_type" required defaultValue="once_off"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
              <option value="once_off">Once-off (payday)</option>
              <option value="instalment">Instalment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Next pay date</label>
            <input name="next_pay_date" type="date"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Purpose category</label>
            <input name="purpose_category" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Referral source</label>
            <input name="referral_source" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Purpose (details)</label>
            <textarea name="purpose_text" rows={2} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prior credit elsewhere?</label>
            <select name="has_prior_credit" defaultValue="no"
              className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
              <option value="no">No</option>
              <option value="had">Had, settled</option>
              <option value="have">Currently have</option>
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-navy text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-navy-light transition disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create application"}
      </button>
    </form>
  );
}
