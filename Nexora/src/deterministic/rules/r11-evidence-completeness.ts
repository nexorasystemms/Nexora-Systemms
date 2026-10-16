import type { RuleResult } from "../schemas/rule-result.js";

export interface EvidenceCompletenessInput {
  idPresent: boolean;
  payslipPresent: boolean;
  employerConfirmationPresent: boolean;
  bankStatementPresent: boolean;
  evidenceAccepted: boolean;
}

export function evaluateR11(
  input: EvidenceCompletenessInput
): RuleResult {
  const incomeEvidencePresent =
    input.payslipPresent ||
    input.employerConfirmationPresent;

  const complete =
    input.idPresent &&
    incomeEvidencePresent &&
    input.bankStatementPresent &&
    input.evidenceAccepted;

  return {
    ruleId: "R11",
    category: "POLICY",
    status: complete ? "PASS" : "FAIL",

    explanation: complete
      ? "Required application evidence is present and accepted."
      : "Required application evidence is incomplete or has not been accepted.",

    overridable: true,
  };
}
