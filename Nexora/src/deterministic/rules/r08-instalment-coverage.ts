import type { RuleResult } from "../schemas/rule-result.js";

export interface InstalmentCoverageInput {
  proposedInstalment: number;
  coverageLimit: number;
}

export function evaluateR08(
  input: InstalmentCoverageInput
): RuleResult {
  const passed =
    input.proposedInstalment <= input.coverageLimit;

  return {
    ruleId: "R08",
    category: "POLICY",
    status: passed ? "PASS" : "FAIL",

    value: input.proposedInstalment,
    threshold: input.coverageLimit,

    explanation: passed
      ? "Proposed instalment is within the permitted disposable-income coverage limit."
      : "Proposed instalment exceeds the permitted disposable-income coverage limit; a reduced loan amount should be considered.",

    overridable: true,
  };
}