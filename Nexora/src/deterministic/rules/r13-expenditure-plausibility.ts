import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface ExpenditurePlausibilityInput {
  declaredIncome: number;
  declaredExpenditure: number;
}

export function evaluateR13(
  input: ExpenditurePlausibilityInput,
  parameters: LoanParameters
): RuleResult {
  if (input.declaredIncome <= 0) {
    return {
      ruleId: "R13",
      category: "CONTROL",
      status: "FLAG",

      explanation:
        "Declared income is zero or negative; expenditure plausibility requires manual review.",

      overridable: true,
    };
  }

  const expenditureRatio =
    input.declaredExpenditure /
    input.declaredIncome;

  const passed =
    expenditureRatio >=
    parameters.minimumExpenditureRatio;

  return {
    ruleId: "R13",
    category: "CONTROL",
    status: passed ? "PASS" : "FLAG",

    value: expenditureRatio,
    threshold:
      parameters.minimumExpenditureRatio,

    explanation: passed
      ? "Declared expenditure meets the configured minimum income ratio."
      : "Declared expenditure is below the configured minimum income ratio; manual plausibility review is required.",

    overridable: true,
  };
}
