import type { ApplicationStatus } from "@/types/database";

// Borrower-facing collapse of the internal ApplicationStatus pipeline (src/components/StatusBadge.tsx
// has the full staff-facing set) into the five stages a non-staff person actually cares about.
export const PORTAL_STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "decision", label: "Decision" },
  { key: "agreement", label: "Agreement" },
  { key: "disbursed", label: "Disbursed" },
] as const;

const STAGE_INDEX_BY_STATUS: Partial<Record<ApplicationStatus, number>> = {
  submitted: 0,
  under_review: 1,
  awaiting_documents: 1,
  assessed: 1,
  approved: 2,
  approved_with_changes: 2,
  declined: 2,
  agreement_generated: 3,
  agreement_accepted: 3,
  disbursed: 4,
  performing: 4,
  in_arrears: 4,
  settled: 4,
  handed_over: 4,
};

/** Index into PORTAL_STAGES, or null for a status the tracker doesn't represent (draft — the
 *  applicant hasn't finished submitting yet — and withdrawn, which never entered the pipeline). */
export function portalStageIndex(status: ApplicationStatus): number | null {
  return STAGE_INDEX_BY_STATUS[status] ?? null;
}

export function isTerminalApplication(status: ApplicationStatus): boolean {
  return status === "settled" || status === "declined" || status === "withdrawn" || status === "handed_over";
}

export type DisclosureParams = {
  loan_ceiling_nad?: number;
  term_ceiling_months?: number;
  finance_charge_cap_short_term_months?: number;
  finance_charge_cap_short_pct?: number;
  finance_charge_cap_long_prime_multiplier?: number;
  prime_rate_pct?: number;
};

/** Same cap-based pricing formula as src/lib/rules-engine/compute.ts's
 *  computeFinanceChargeAndInstalment, kept separate because the portal only ever has the six
 *  disclosure-safe params (see portal_disclosure_params in the 0009 migration), not the full
 *  PolicyParams the staff engine loads. This is a *disclosure preview* only — the authoritative
 *  figures are recomputed by the staff-side engine once the application reaches assessment. */
export function computeDisclosure(amount: number, termMonths: number, params: DisclosureParams) {
  const shortTermMonths = params.finance_charge_cap_short_term_months ?? 5;
  const shortPct = params.finance_charge_cap_short_pct ?? 0.3;
  const primeRate = params.prime_rate_pct ?? 0;
  const longMultiplier = params.finance_charge_cap_long_prime_multiplier ?? 2;

  const isShortTerm = termMonths <= shortTermMonths;
  const financeCharge = isShortTerm
    ? round2(amount * shortPct)
    : round2(amount * primeRate * longMultiplier * (termMonths / 12));
  const totalRepayable = round2(amount + financeCharge);
  const instalment = isShortTerm ? totalRepayable : round2(totalRepayable / termMonths);

  return { isShortTerm, financeCharge, totalRepayable, instalment };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
