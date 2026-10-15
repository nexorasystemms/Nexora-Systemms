import type { RuleResult } from "../schemas/rule-result.js";

export interface MaturityAlignmentInput {
  onceOffPaydayProduct: boolean;
  proposedDueDate: string | undefined;
  declaredNextPayDate: string | undefined;
}

export function evaluateR14(
  input: MaturityAlignmentInput
): RuleResult {
  // R14 only applies to once-off payday products.
  if (!input.onceOffPaydayProduct) {
    return {
      ruleId: "R14",
      category: "CONTROL",
      status: "PASS",

      explanation:
        "Maturity alignment check does not apply because this is not a once-off payday product.",

      overridable: true,
    };
  }

  if (
    !input.proposedDueDate ||
    !input.declaredNextPayDate
  ) {
    return {
      ruleId: "R14",
      category: "CONTROL",
      status: "FLAG",

      explanation:
        "Maturity alignment cannot be verified because the proposed due date or declared next pay date is missing.",

      overridable: true,
    };
  }

  const dueDate = new Date(
    input.proposedDueDate
  );

  const nextPayDate = new Date(
    input.declaredNextPayDate
  );

  if (
    Number.isNaN(dueDate.getTime()) ||
    Number.isNaN(nextPayDate.getTime())
  ) {
    return {
      ruleId: "R14",
      category: "CONTROL",
      status: "FLAG",

      explanation:
        "Maturity alignment cannot be verified because one or more supplied dates are invalid.",

      overridable: true,
    };
  }

  const passed =
    dueDate.getTime() <=
    nextPayDate.getTime();

  return {
    ruleId: "R14",
    category: "CONTROL",
    status: passed ? "PASS" : "FLAG",

    explanation: passed
      ? "Proposed maturity date is on or before the declared next pay date."
      : "Proposed maturity date is after the declared next pay date; product maturity requires human review.",

    overridable: true,
  };
}