import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface LongTermEffectiveRateInput {
  termMonths: number;
  effectiveRate: number;
  primeRate: number;
}

export function evaluateR04(
  input: LongTermEffectiveRateInput,
  parameters: LoanParameters
): RuleResult {
  // R04 applies only to loans longer than 5 months.
  if (input.termMonths <= parameters.shortTermMaximumMonths) {
    return {
      ruleId: "R04",
      category: "REGULATORY",
      status: "PASS",
      explanation:
        "Long-term effective-rate cap does not apply because the loan term is within the short-term threshold.",
      overridable: false,
    };
  }

  const maximumEffectiveRate = input.primeRate * 2;

  const passed =
    input.effectiveRate <= maximumEffectiveRate;

  return {
    ruleId: "R04",
    category: "REGULATORY",
    status: passed ? "PASS" : "FAIL",

    value: input.effectiveRate,
    threshold: maximumEffectiveRate,

    explanation: passed
      ? "Effective rate is within the permitted long-term limit."
      : "Effective rate exceeds the permitted long-term limit.",

    overridable: false,
  };
}