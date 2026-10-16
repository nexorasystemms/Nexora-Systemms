export type RuleCategory =
  | "REGULATORY"
  | "POLICY"
  | "CONTROL";

export type RuleStatus =
  | "PASS"
  | "FAIL"
  | "FLAG";

export interface RuleResult {
  ruleId: string;
  category: RuleCategory;
  status: RuleStatus;

  value?: number;
  threshold?: number;

  explanation: string;

  overridable: boolean;
}
