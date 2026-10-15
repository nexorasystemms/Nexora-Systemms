import type { RuleResult } from "../schemas/rule-result.js";

export interface DependantFloorInput {
  disposableIncome: number;
  proposedInstalment: number;
  livingAllowanceFloor: number;
}

export function evaluateR10(
  input: DependantFloorInput
): RuleResult {
  const remainingAfterInstalment =
    input.disposableIncome -
    input.proposedInstalment;

  const passed =
    remainingAfterInstalment >=
    input.livingAllowanceFloor;

  return {
    ruleId: "R10",
    category: "POLICY",
    status: passed ? "PASS" : "FAIL",

    value: remainingAfterInstalment,
    threshold: input.livingAllowanceFloor,

    explanation: passed
      ? "Remaining disposable income satisfies the configured dependant living allowance floor."
      : "Remaining disposable income is below the configured dependant living allowance floor.",

    overridable: true,
  };
}