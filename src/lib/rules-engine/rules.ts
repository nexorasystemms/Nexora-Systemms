// SRS §4.4.2, Table 15 — the sixteen rules, evaluated for every application reaching the
// `assessed` state (FR-ENG-02). Rule type governs override behaviour:
//   Regulatory — hard block, no override available to any role (FR-ENG-03).
//   Policy     — produces a recommendation an approver may override with a reason code.
//   Control    — raises a flag for human confirmation.
//   Product    — flags a product-structure mismatch (once-off maturity alignment).

import type { AssessmentInput, ComputedFigures, PolicyParams, RuleResult } from "./types";

export function evaluateRules(
  input: AssessmentInput,
  params: PolicyParams,
  figures: ComputedFigures,
): RuleResult[] {
  const results: RuleResult[] = [];

  // R-01 Loan ceiling
  results.push({
    id: "R-01",
    label: "Loan ceiling",
    type: "Regulatory",
    passed: input.amountRequested <= params.loan_ceiling_nad,
    flagged: false,
    overridable: false,
    detail: `Requested N$${input.amountRequested.toFixed(2)} vs ceiling N$${params.loan_ceiling_nad.toFixed(2)}`,
  });

  // R-02 Term ceiling
  results.push({
    id: "R-02",
    label: "Term ceiling",
    type: "Regulatory",
    passed: input.termMonths <= params.term_ceiling_months,
    flagged: false,
    overridable: false,
    detail: `Term ${input.termMonths}mo vs ceiling ${params.term_ceiling_months}mo`,
  });

  // R-03 Finance charge cap (short term)
  const isShortTerm = input.termMonths <= params.finance_charge_cap_short_term_months;
  const shortTermCapAmount = round2(input.amountRequested * params.finance_charge_cap_short_pct);
  results.push({
    id: "R-03",
    label: "Finance charge cap (short)",
    type: "Regulatory",
    passed: !isShortTerm || figures.financeCharge <= shortTermCapAmount + 0.01,
    flagged: false,
    overridable: false,
    detail: isShortTerm
      ? `Finance charge N$${figures.financeCharge.toFixed(2)} vs cap N$${shortTermCapAmount.toFixed(2)} (30% of principal)`
      : "Not applicable — term exceeds short-term threshold",
  });

  // R-04 Finance charge cap (long term)
  const maxLongTermRate = params.prime_rate_pct * params.finance_charge_cap_long_prime_multiplier;
  results.push({
    id: "R-04",
    label: "Finance charge cap (long)",
    type: "Regulatory",
    passed: isShortTerm || maxLongTermRate <= params.prime_rate_pct * params.finance_charge_cap_long_prime_multiplier,
    flagged: false,
    overridable: false,
    detail: isShortTerm
      ? "Not applicable — term within short-term threshold"
      : `Effective rate capped at ${(maxLongTermRate * 100).toFixed(2)}% (2x prime of ${(params.prime_rate_pct * 100).toFixed(2)}%)`,
  });

  // R-05 Penalty cap — validates the *configured* penalty rate is lawful (actual accrual is
  // enforced later, per loan, by FR-REPAY-04).
  const REGULATORY_MAX_PENALTY_PCT = 0.30; // TODO confirm against Gen. Notice 263 (GG 6736)
  results.push({
    id: "R-05",
    label: "Penalty cap",
    type: "Regulatory",
    passed: params.penalty_cap_pct <= REGULATORY_MAX_PENALTY_PCT,
    flagged: false,
    overridable: false,
    detail: `Configured penalty cap ${(params.penalty_cap_pct * 100).toFixed(1)}% vs regulatory max ${(REGULATORY_MAX_PENALTY_PCT * 100).toFixed(1)}%`,
  });

  // R-06 Penalty duration
  results.push({
    id: "R-06",
    label: "Penalty duration",
    type: "Regulatory",
    passed: params.penalty_duration_days <= 90,
    flagged: false,
    overridable: false,
    detail: `Configured penalty duration ${params.penalty_duration_days} days vs 90-day statutory stop`,
  });

  // R-07 Positive surplus
  results.push({
    id: "R-07",
    label: "Positive surplus",
    type: "Policy",
    passed: figures.S > 0,
    flagged: false,
    overridable: true,
    detail: `Surplus S = N$${figures.S.toFixed(2)}`,
  });

  // R-08 Instalment coverage: I <= alpha * S
  const maxInstalmentByAlpha = round2(params.alpha_instalment_coverage * figures.S);
  results.push({
    id: "R-08",
    label: "Instalment coverage",
    type: "Policy",
    passed: figures.I <= maxInstalmentByAlpha,
    flagged: false,
    overridable: true,
    detail: `Instalment N$${figures.I.toFixed(2)} vs alpha*S = N$${maxInstalmentByAlpha.toFixed(2)} (alpha=${params.alpha_instalment_coverage})`,
  });

  // R-09 Debt-service ratio
  results.push({
    id: "R-09",
    label: "Debt-service ratio",
    type: "Policy",
    passed: figures.DSR <= params.beta_dsr_ceiling,
    flagged: false,
    overridable: true,
    detail: `DSR ${(figures.DSR * 100).toFixed(1)}% vs ceiling ${(params.beta_dsr_ceiling * 100).toFixed(1)}%`,
  });

  // R-10 Dependant floor
  const requiredFloor = round2(params.min_living_allowance_nad * (1 + input.dependantsCount));
  const residual = round2(figures.S - figures.I);
  results.push({
    id: "R-10",
    label: "Dependant floor",
    type: "Policy",
    passed: residual >= requiredFloor,
    flagged: false,
    overridable: true,
    detail: `S - I = N$${residual.toFixed(2)} vs floor N$${requiredFloor.toFixed(2)} (${input.dependantsCount} dependants)`,
  });

  // R-11 Evidence completeness
  const evidenceOk =
    input.evidence.idAccepted &&
    input.evidence.bankStatementAccepted &&
    (input.evidence.payslipAvailable
      ? input.evidence.payslipAcceptedOrAlternativeAgreed
      : input.evidence.payslipAcceptedOrAlternativeAgreed); // no-payslip path requires the agreed alternative to be marked accepted (FR-DOC-05)
  results.push({
    id: "R-11",
    label: "Evidence completeness",
    type: "Policy",
    passed: evidenceOk,
    flagged: false,
    overridable: true,
    detail: evidenceOk
      ? "ID, income evidence (or agreed alternative), and bank statement all accepted"
      : "Missing or unaccepted required evidence — see document checklist",
  });

  // R-12 Income variance — dormant until Phase 2 extraction supplies an evidenced figure.
  const varianceOk =
    !input.incomeVarianceKnown ||
    input.declaredVsEvidencedVariancePct == null ||
    Math.abs(input.declaredVsEvidencedVariancePct) <= params.income_variance_threshold_pct;
  results.push({
    id: "R-12",
    label: "Income variance",
    type: "Control",
    passed: varianceOk,
    flagged: input.incomeVarianceKnown && !varianceOk,
    overridable: true,
    detail: input.incomeVarianceKnown
      ? `Variance ${((input.declaredVsEvidencedVariancePct ?? 0) * 100).toFixed(1)}% vs threshold ${(params.income_variance_threshold_pct * 100).toFixed(1)}%`
      : "Dormant in the pilot — no extraction available to compare against declared income",
  });

  // R-13 Expenditure plausibility
  const minExpenditure = round2(figures.D * params.expenditure_plausibility_min_pct);
  const expenditurePlausible = figures.E >= minExpenditure;
  results.push({
    id: "R-13",
    label: "Expenditure plausibility",
    type: "Control",
    passed: expenditurePlausible,
    flagged: !expenditurePlausible,
    overridable: true,
    detail: `Declared expenditure N$${figures.E.toFixed(2)} vs minimum plausible N$${minExpenditure.toFixed(2)} (${(params.expenditure_plausibility_min_pct * 100).toFixed(0)}% of income)`,
  });

  // R-14 Maturity alignment (once-off products only)
  let maturityOk = true;
  if (input.productType === "once_off") {
    maturityOk = !!input.nextPayDate && new Date(input.nextPayDate) >= new Date(input.applicationSubmittedDate);
  }
  results.push({
    id: "R-14",
    label: "Maturity alignment",
    type: "Product",
    passed: maturityOk,
    flagged: !maturityOk,
    overridable: true,
    detail: input.productType === "once_off"
      ? `Due date ${input.nextPayDate ?? "(not set)"} must be on/after the declared next pay date`
      : "Not applicable — instalment product",
  });

  // R-15 Duplicate / concurrent application
  results.push({
    id: "R-15",
    label: "Duplicate / concurrent",
    type: "Control",
    passed: !input.hasOtherLiveApplication,
    flagged: input.hasOtherLiveApplication,
    overridable: true,
    detail: input.hasOtherLiveApplication
      ? "Applicant has another live application or unsettled loan"
      : "No other live application found for this applicant",
  });

  // R-16 Bureau consent
  const bureauOk = !input.bureauSubmissionAttempted || input.bureauConsentRecorded;
  results.push({
    id: "R-16",
    label: "Bureau consent",
    type: "Regulatory",
    passed: bureauOk,
    flagged: false,
    overridable: false,
    detail: input.bureauSubmissionAttempted
      ? (bureauOk ? "Bureau consent recorded before submission" : "Bureau submission attempted without recorded consent")
      : "No bureau submission in this application",
  });

  return results;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
