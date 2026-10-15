
import type { RuleResult } from "../schemas/rule-result.js";

export interface BureauConsentInput {
  bureauConsentRecorded: boolean;
}

export function evaluateR16(
  input: BureauConsentInput
): RuleResult {
  const passed =
    input.bureauConsentRecorded;

  return {
    ruleId: "R16",
    category: "REGULATORY",
    status: passed ? "PASS" : "FAIL",

    explanation: passed
      ? "Bureau consent has been recorded before bureau submission."
      : "Bureau consent has not been recorded; bureau submission must be blocked.",

    overridable: false,
  };
}