import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface IncomeVarianceInput {
  declaredNetSalary: number;
  extractedNetSalary: number | undefined;
}

export function evaluateR12(
  input: IncomeVarianceInput,
  parameters: LoanParameters
): RuleResult {
  // R12 remains dormant until Phase 2 extraction
  // is available.
  if (input.extractedNetSalary === undefined) {
    return {
      ruleId: "R12",
      category: "CONTROL",
      status: "PASS",

      explanation:
        "Income variance check is dormant because automated income extraction is not yet enabled.",

      overridable: true,
    };
  }

  if (input.declaredNetSalary === 0) {
    return {
      ruleId: "R12",
      category: "CONTROL",
      status: "FLAG",

      explanation:
        "Declared net salary is zero; manual income verification is required.",

      overridable: true,
    };
  }

  const variance =
    Math.abs(
      input.declaredNetSalary -
        input.extractedNetSalary
    ) /
    Math.abs(input.declaredNetSalary);

  const passed =
    variance <=
    parameters.incomeVarianceTolerance;

  return {
    ruleId: "R12",
    category: "CONTROL",
    status: passed ? "PASS" : "FLAG",

    value: variance,
    threshold:
      parameters.incomeVarianceTolerance,

    explanation: passed
      ? "Declared net salary is within the configured income variance tolerance."
      : "Declared net salary differs from evidenced net salary beyond the configured tolerance; manual confirmation is required.",

    overridable: true,
  };
}

