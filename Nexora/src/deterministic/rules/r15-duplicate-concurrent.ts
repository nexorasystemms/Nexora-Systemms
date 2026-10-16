import type { RuleResult } from "../schemas/rule-result.js";

export interface DuplicateConcurrentInput {
  hasLiveApplicationOrUnsettledLoan: boolean;
}

export function evaluateR15(
  input: DuplicateConcurrentInput
): RuleResult {
  const passed =
    !input.hasLiveApplicationOrUnsettledLoan;

  return {
    ruleId: "R15",
    category: "CONTROL",
    status: passed ? "PASS" : "FLAG",

    explanation: passed
      ? "No live application or unsettled loan was identified for the applicant."
      : "A live application or unsettled loan was identified; human review is required.",

    overridable: true,
  };
}
