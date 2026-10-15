import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface PenaltyDurationInput {
  daysPastDue: number;
}

export function evaluateR06(
  input: PenaltyDurationInput,
  parameters: LoanParameters
): RuleResult {
  const passed =
    input.daysPastDue <= parameters.penaltyDurationDays;

  return {
    ruleId: "R06",
    category: "REGULATORY",
    status: passed ? "PASS" : "FAIL",

    value: input.daysPastDue,
    threshold: parameters.penaltyDurationDays,

    explanation: passed
      ? "Default interest duration is within the permitted limit."
      : "Default interest has reached the permitted duration limit and hand-over is required.",

    overridable: false,
  };
}