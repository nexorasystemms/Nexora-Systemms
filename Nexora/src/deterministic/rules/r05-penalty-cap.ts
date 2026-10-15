import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface PenaltyCapInput {
  outstandingAmount: number;
  defaultCharges: number;
}

export function evaluateR05(
  input: PenaltyCapInput,
  parameters: LoanParameters
): RuleResult {
  const maximumDefaultCharges =
    input.outstandingAmount * parameters.penaltyCapRate;

  const passed =
    input.defaultCharges <= maximumDefaultCharges;

  return {
    ruleId: "R05",
    category: "REGULATORY",
    status: passed ? "PASS" : "FAIL",

    value: input.defaultCharges,
    threshold: maximumDefaultCharges,

    explanation: passed
      ? "Default charges are within the configured penalty cap."
      : "Default charges exceed the configured penalty cap.",

    overridable: false,
  };
}