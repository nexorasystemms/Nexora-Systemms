// SRS §4.4 — orchestrates computation (Table 14) + rule evaluation (Table 15) into a single
// AssessmentResult, exactly the shape `assessments` rows are stamped from (FR-ENG-01/02/04).

import { computeFigures } from "./compute";
import { evaluateRules } from "./rules";
import {
  AssessmentInput, AssessmentResult, ComputedFigures, ENGINE_VERSION, PolicyParams, RuleResult,
} from "./types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const RULE_PRIORITY: Record<RuleResult["type"], number> = {
  Regulatory: 0,
  Policy: 1,
  Product: 2,
  Control: 3,
};

function pickBindingConstraint(failed: RuleResult[]): RuleResult | null {
  if (failed.length === 0) return null;
  return [...failed].sort((a, b) => RULE_PRIORITY[a.type] - RULE_PRIORITY[b.type])[0];
}

/**
 * FR-ENG-07: when R-07–R-10 would decline, compute the maximum principal the applicant's
 * current surplus could support, so a bare decline becomes an actionable alternative.
 * Returns null when even a nominal loan would be unaffordable (S <= 0 — R-07 territory,
 * which no amount of principal reduction fixes) or when nothing failed to begin with.
 */
export function computeMaxAffordablePrincipal(
  input: AssessmentInput,
  params: PolicyParams,
  figures: ComputedFigures,
): number | null {
  if (figures.S <= 0) return null;

  const isShortTerm = input.termMonths <= params.finance_charge_cap_short_term_months;
  const instalmentFactor = isShortTerm
    ? 1 + params.finance_charge_cap_short_pct
    : (1 + params.prime_rate_pct * params.finance_charge_cap_long_prime_multiplier * (input.termMonths / 12)) / input.termMonths;

  const capByAlpha = (params.alpha_instalment_coverage * figures.S) / instalmentFactor;
  const capByDsr = (params.beta_dsr_ceiling * figures.D - figures.O) / instalmentFactor;
  const requiredFloor = params.min_living_allowance_nad * (1 + input.dependantsCount);
  const capByDependantFloor = (figures.S - requiredFloor) / instalmentFactor;

  const maxPrincipal = Math.min(capByAlpha, capByDsr, capByDependantFloor, params.loan_ceiling_nad);
  if (!isFinite(maxPrincipal) || maxPrincipal <= 0) return 0;

  return round2(maxPrincipal);
}

export function runAssessment(input: AssessmentInput, policyParamsUsed: PolicyParams): AssessmentResult {
  const figures = computeFigures(input, policyParamsUsed);
  const rules = evaluateRules(input, policyParamsUsed, figures);

  const rulesPassed = rules.filter((r) => r.passed);
  const rulesFailed = rules.filter((r) => !r.passed);
  const rulesFlagged = rules.filter((r) => r.flagged);

  const hasRegulatoryFailure = rulesFailed.some((r) => r.type === "Regulatory");
  const hasPolicyFailure = rulesFailed.some((r) => r.type === "Policy");

  const bindingConstraint = pickBindingConstraint(rulesFailed);
  const recommendedOutcome: "approve" | "decline" = hasRegulatoryFailure || hasPolicyFailure ? "decline" : "approve";

  const needsAffordableAmount = rulesFailed.some((r) => ["R-07", "R-08", "R-09", "R-10"].includes(r.id));
  const maxAffordablePrincipal = needsAffordableAmount
    ? computeMaxAffordablePrincipal(input, policyParamsUsed, figures)
    : null;

  return {
    engineVersion: ENGINE_VERSION,
    policyParamsUsed,
    figures,
    rules,
    rulesPassed,
    rulesFailed,
    rulesFlagged,
    bindingConstraint,
    hasRegulatoryFailure,
    recommendedOutcome,
    maxAffordablePrincipal,
  };
}

export * from "./types";
export * from "./compute";
export * from "./rules";
