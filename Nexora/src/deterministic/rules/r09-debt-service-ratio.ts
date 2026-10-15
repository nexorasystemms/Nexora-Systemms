import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface DebtServiceRatioInput {
  debtServiceRatio: number;
}

export function evaluateR09(
  input: DebtServiceRatioInput,
  parameters: LoanParameters
): RuleResult {
  const passed =
    input.debtServiceRatio <=
    parameters.betaDebtServiceRatio;

  return {
    ruleId: "R09",
    category: "POLICY",
    status: passed ? "PASS" : "FAIL",

    value: input.debtServiceRatio,
    threshold: parameters.betaDebtServiceRatio,

    explanation: passed
      ? "Debt-service ratio is within the configured policy limit."
      : "Debt-service ratio exceeds the configured policy limit.",

    overridable: true,
  };
}