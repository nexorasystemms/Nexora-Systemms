import type { RuleResult } from "../schemas/rule-result.js";

export interface PositiveSurplusInput {
  disposableIncome: number;
}

export function evaluateR07(
  input: PositiveSurplusInput
): RuleResult {
  const passed = input.disposableIncome > 0;

  return {
    ruleId: "R07",
    category: "POLICY",
    status: passed ? "PASS" : "FAIL",

    value: input.disposableIncome,
    threshold: 0,

    explanation: passed
      ? "Applicant has a positive disposable income surplus."
      : "Applicant does not have a positive disposable income surplus.",

    overridable: true,
  };
}