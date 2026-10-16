import type { RuleResult } from "./rule-result.js";

export type AffordabilityStatus =
  | "PASS"
  | "FAIL"
  | "REVIEW";

export interface AffordabilityResult {
  applicationId: string;

  status: AffordabilityStatus;

  rules: RuleResult[];

  hardBlocks: string[];

  policyFailures: string[];

  controlFlags: string[];

  bindingConstraint?: string;

  calculatedValues: {
    totalIncome?: number;
    disposableIncome?: number;
    existingLoanObligations?: number;
    proposedInstalment?: number;
    debtServiceRatio?: number;
    coverageLimit?: number;
    livingAllowanceFloor?: number;
  };

  rulesetVersion: string;

  evaluatedAt: string;
}