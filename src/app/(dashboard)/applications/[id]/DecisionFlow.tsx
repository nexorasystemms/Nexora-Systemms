"use client";

import { useTransition } from "react";
import {
  runApplicationAssessment, recordDecision, generateAgreement, recordAcceptance,
  recordDisbursement, recordRepayment,
} from "./actions";
import type {
  AssessmentRow, DecisionRow, AgreementRow, LoanRow, ScheduleRow, RepaymentRow, StaffRole,
} from "@/types/database";
import type { RuleResult } from "@/lib/rules-engine/types";
import { canDecide, canDisburse } from "@/lib/roles";
import { formatNad, formatDate, formatDateTime } from "@/lib/format";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-brand-navy mb-4">{title}</h2>
      {children}
    </div>
  );
}

export function AssessmentSection({ applicationId, assessment, canRun }: { applicationId: string; assessment: AssessmentRow | null; canRun: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card title="Affordability & Rules Engine">
      {!assessment && (
        <div>
          <p className="text-sm text-brand-muted mb-3">
            Runs the deterministic sixteen-rule engine (§4.4) against the captured data. No network or model call.
          </p>
          <button
            onClick={() => startTransition(() => runApplicationAssessment(applicationId))}
            disabled={!canRun || pending}
            className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50"
          >
            {pending ? "Assessing…" : "Run assessment"}
          </button>
          {!canRun && <p className="text-xs text-warning mt-2">Complete employment, income/expenditure, and document review first.</p>}
        </div>
      )}

      {assessment && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 bg-gray-50 rounded-md p-3 text-sm">
            <Figure label="D (income)" value={assessment.computed_d} />
            <Figure label="E (expenditure)" value={assessment.computed_e} />
            <Figure label="S (surplus)" value={assessment.computed_s} tone={Number(assessment.computed_s) > 0 ? "success" : "danger"} />
            <Figure label="O (obligations)" value={assessment.computed_o} />
            <Figure label="I (instalment)" value={assessment.computed_i} />
            <Figure label="DSR" value={assessment.computed_dsr} isPct />
          </div>

          {assessment.max_affordable_principal != null && (
            <div className="rounded-md bg-blue-50 border border-blue-200 text-sm px-3 py-2">
              Maximum affordable principal at current surplus: <strong>{formatNad(assessment.max_affordable_principal)}</strong> (FR-ENG-07)
            </div>
          )}

          <div>
            <table className="w-full text-xs">
              <thead className="text-brand-muted uppercase">
                <tr><th className="text-left py-1">Rule</th><th className="text-left py-1">Type</th><th className="text-left py-1">Result</th><th className="text-left py-1">Detail</th></tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {(assessment.rules_passed as RuleResult[]).concat(assessment.rules_failed as RuleResult[]).sort((a, b) => a.id.localeCompare(b.id)).map((r) => (
                  <tr key={r.id} className={r.id === assessment.binding_constraint ? "bg-amber-50" : ""}>
                    <td className="py-1.5 font-medium">{r.id} {r.label}</td>
                    <td className="py-1.5">{r.type}</td>
                    <td className="py-1.5">
                      {r.passed ? <span className="text-success">Pass</span> : r.flagged ? <span className="text-warning">Flag</span> : <span className="text-danger">Fail</span>}
                    </td>
                    <td className="py-1.5 text-brand-muted">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function Figure({ label, value, tone, isPct }: { label: string; value: number | null; tone?: "success" | "danger"; isPct?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-brand-muted">{label}</div>
      <div className={`font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}>
        {value == null ? "—" : isPct ? `${(value * 100).toFixed(1)}%` : formatNad(value)}
      </div>
    </div>
  );
}

const REASON_CODES = [
  "meets_all_criteria", "affordability_marginal_approved_reduced", "evidence_alternative_accepted",
  "manual_review_override", "insufficient_surplus", "dsr_exceeded", "incomplete_evidence", "other",
];

export function DecisionSection({
  applicationId, assessment, decision, role, requestedAmount, requestedTerm,
}: {
  applicationId: string; assessment: AssessmentRow | null; decision: DecisionRow | null; role: StaffRole;
  requestedAmount: number; requestedTerm: number;
}) {
  const [pending, startTransition] = useTransition();
  if (!assessment) return null;

  const hasRegulatoryFailure = (assessment.rules_failed as RuleResult[]).some((r) => r.type === "Regulatory");

  return (
    <Card title="Credit Decision">
      {decision ? (
        <div className="text-sm space-y-1">
          <p><strong className="capitalize">{decision.outcome.replace("_", " ")}</strong> by decision on {formatDateTime(decision.decided_at)}</p>
          <p className="text-brand-muted">Reason: {decision.reason_code}{decision.notes ? ` — ${decision.notes}` : ""}</p>
          {decision.is_override && <p className="text-warning">Recorded as an override (a policy/control rule failed or flagged).</p>}
          {decision.amount_approved != null && <p>Approved: {formatNad(decision.amount_approved)} over {decision.term_approved} months</p>}
        </div>
      ) : canDecide(role) ? (
        <form
          action={(fd) => startTransition(() => recordDecision(applicationId, assessment.id, fd))}
          className="space-y-3"
        >
          {hasRegulatoryFailure && (
            <p className="text-sm text-danger">A regulatory rule failed — only Decline is available (FR-ENG-03).</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Outcome *</label>
              <select name="outcome" required defaultValue="" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
                <option value="" disabled>Select…</option>
                {!hasRegulatoryFailure && <option value="approved">Approve (as requested)</option>}
                {!hasRegulatoryFailure && <option value="approved_with_changes">Approve with changes</option>}
                <option value="declined">Decline</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Amount approved</label>
              <input name="amount_approved" type="number" step="0.01" defaultValue={requestedAmount} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Term approved (months)</label>
              <input name="term_approved" type="number" defaultValue={requestedTerm} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Reason code *</label>
            <select name="reason_code" required defaultValue="" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
              <option value="" disabled>Select…</option>
              {REASON_CODES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
            {pending ? "Recording…" : "Record decision"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-brand-muted">Waiting for an approver to record a decision.</p>
      )}
    </Card>
  );
}

export function AgreementSection({
  applicationId, decision, agreement, role,
}: { applicationId: string; decision: DecisionRow | null; agreement: AgreementRow | null; role: StaffRole }) {
  const [pending, startTransition] = useTransition();
  if (!decision || decision.outcome === "declined") return null;

  return (
    <Card title="Agreement">
      {agreement ? (
        <div className="text-sm space-y-2">
          <p className="font-medium">{agreement.reference_number}</p>
          <p>Principal {formatNad(agreement.principal)} + finance charge {formatNad(agreement.finance_charge)} = {formatNad(agreement.total_repayable)}</p>
          <p className="text-xs text-brand-muted break-all">SHA-256: {agreement.pdf_sha256_hash}</p>
          {!agreement.acceptance_timestamp ? (
            canDecide(role) && (
              <form action={(fd) => startTransition(() => recordAcceptance(applicationId, agreement.id, fd))} className="mt-3 space-y-2 border-t border-brand-border pt-3">
                <p className="text-xs text-brand-muted">Capture the borrower&apos;s acceptance evidence (FR-AGR-06).</p>
                <select name="acceptance_method" defaultValue="device_signature" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
                  <option value="device_signature">Device-captured signature</option>
                  <option value="signed_photo">Signed & photographed copy</option>
                </select>
                <button type="submit" disabled={pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
                  {pending ? "Recording…" : "Record acceptance"}
                </button>
              </form>
            )
          ) : (
            <p className="text-success text-xs">Accepted {formatDateTime(agreement.acceptance_timestamp)} via {agreement.acceptance_method}</p>
          )}
        </div>
      ) : canDecide(role) ? (
        <div>
          <p className="text-sm text-brand-muted mb-3">Populates the version-controlled template from the decision figures (FR-AGR-01). Blocked if the finance charge would exceed the regulatory cap (FR-AGR-03) or the template has not been attorney-reviewed (FR-AGR-08).</p>
          <button
            onClick={() => startTransition(() => generateAgreement(applicationId, decision.id))}
            disabled={pending}
            className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate agreement"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export function DisbursementSection({
  applicationId, agreement, decidedBy, currentUserId, role, loan,
}: { applicationId: string; agreement: AgreementRow | null; decidedBy: string | null; currentUserId: string; role: StaffRole; loan: LoanRow | null }) {
  const [pending, startTransition] = useTransition();
  if (!agreement?.acceptance_timestamp) return null;

  const isSamePerson = decidedBy === currentUserId;

  return (
    <Card title="Disbursement">
      {loan ? (
        <div className="text-sm space-y-1">
          <p>{formatNad(loan.disbursed_amount)} disbursed {formatDateTime(loan.disbursed_at)} via {loan.disbursement_method}</p>
          <p className="text-brand-muted">Reference: {loan.disbursement_reference}</p>
          {loan.role_switch_acknowledged && <p className="text-warning text-xs">Logged role-switch: {loan.role_switch_reason}</p>}
        </div>
      ) : canDisburse(role) ? (
        <form action={(fd) => startTransition(() => recordDisbursement(applicationId, agreement.id, decidedBy!, fd))} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Method *</label>
              <select name="disbursement_method" required defaultValue="" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm bg-white">
                <option value="" disabled>Select…</option>
                <option value="eft">EFT</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Bank reference *</label>
              <input name="disbursement_reference" required className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            </div>
          </div>
          {isSamePerson && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-xs text-amber-800">You are the same person who approved this loan. TMU is a single-branch operation — this is allowed only via an explicit, logged role-switch (FR-DISB-03).</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="role_switch_acknowledged" required />
                I am deliberately switching context from approver to disburser
              </label>
              <input name="role_switch_reason" placeholder="Reason (e.g. sole staff member on duty)" className="w-full rounded-md border border-brand-border px-3 py-2 text-sm" />
            </div>
          )}
          <button type="submit" disabled={pending} className="rounded-md bg-brand-navy text-white text-sm font-medium px-4 py-2 hover:bg-brand-navy-light transition disabled:opacity-50">
            {pending ? "Recording…" : "Record disbursement"}
          </button>
        </form>
      ) : null}
    </Card>
  );
}

export function RepaymentSection({
  applicationId, loan, schedules, repayments, role,
}: { applicationId: string; loan: LoanRow | null; schedules: ScheduleRow[]; repayments: RepaymentRow[]; role: StaffRole }) {
  const [pending, startTransition] = useTransition();
  if (!loan) return null;

  return (
    <Card title="Repayment Schedule">
      <div className="space-y-2">
        {schedules.map((s) => {
          const payment = repayments.find((r) => r.schedule_id === s.id);
          return (
            <div key={s.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
              <div>
                <span className="font-medium">#{s.instalment_number}</span> due {formatDate(s.due_date)} — {formatNad(s.amount_due)}
              </div>
              {payment ? (
                <span className={payment.variance != null && payment.variance < 0 ? "text-warning" : "text-success"}>
                  Paid {formatNad(payment.amount_paid)} on {formatDate(payment.paid_date)}
                  {payment.variance ? ` (variance ${formatNad(payment.variance)})` : ""}
                </span>
              ) : canDisburse(role) ? (
                <form
                  action={(fd) => startTransition(() => recordRepayment(applicationId, loan.id, s.id, Number(s.amount_due), fd))}
                  className="flex items-center gap-2"
                >
                  <input name="amount_paid" type="number" step="0.01" placeholder="Amount" required className="w-24 rounded-md border border-brand-border px-2 py-1 text-xs" />
                  <input name="paid_date" type="date" required className="rounded-md border border-brand-border px-2 py-1 text-xs" />
                  <input name="reference" placeholder="Ref" className="w-20 rounded-md border border-brand-border px-2 py-1 text-xs" />
                  <button type="submit" disabled={pending} className="text-xs rounded-md bg-brand-navy text-white px-2 py-1 disabled:opacity-50">Record</button>
                </form>
              ) : (
                <span className="text-brand-muted text-xs">{s.status}</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
