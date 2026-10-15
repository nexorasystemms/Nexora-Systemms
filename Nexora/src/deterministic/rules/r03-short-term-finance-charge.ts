import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface ShortTermFinanceChargeInput {
  loanAmount: number;
  termMonths: number;
  totalFinanceCharges: number;
}

export function evaluateR03(
  input: ShortTermFinanceChargeInput,
  parameters: LoanParameters
): RuleResult {
  // R03 only applies to loans of 5 months or less.
  if (input.termMonths > parameters.shortTermMaximumMonths) {
    return {
      ruleId: "R03",
      category: "REGULATORY",
      status: "PASS",
      explanation:
        "Short-term finance charge cap does not apply because the loan term exceeds the short-term threshold.",
      overridable: false,
    };
  }

  const maximumFinanceCharges =
    input.loanAmount * parameters.shortTermFinanceChargeRate;

  const passed =
    input.totalFinanceCharges <= maximumFinanceCharges;

  return {
    ruleId: "R03",
    category: "REGULATORY",
    status: passed ? "PASS" : "FAIL",

    value: input.totalFinanceCharges,
    threshold: maximumFinanceCharges,

    explanation: passed
      ? "Total finance charges are within the permitted short-term cap."
      : "Total finance charges exceed the permitted short-term cap.",

    overridable: false,
  };
}