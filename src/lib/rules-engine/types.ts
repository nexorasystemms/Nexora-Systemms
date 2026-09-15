// Nexora Cash Loan module — deterministic affordability & decision rules engine.
// Pure functions only (SRS §4.4: "no network call, no model call"). Every number that can
// end up on a signed agreement is produced here and accepted by a human, never drafted by a
// language model (SRS §1.2 / §2.1).

export const ENGINE_VERSION = "1.0.0";

export type RuleType = "Regulatory" | "Policy" | "Control" | "Product";

export type RuleId =
  | "R-01" | "R-02" | "R-03" | "R-04" | "R-05" | "R-06" | "R-07" | "R-08"
  | "R-09" | "R-10" | "R-11" | "R-12" | "R-13" | "R-14" | "R-15" | "R-16";

export interface PolicyParams {
  loan_ceiling_nad: number;
  term_ceiling_months: number;
  finance_charge_cap_short_term_months: number;
  finance_charge_cap_short_pct: number;
  finance_charge_cap_long_prime_multiplier: number;
  prime_rate_pct: number;
  penalty_cap_pct: number;
  penalty_duration_days: number;
  alpha_instalment_coverage: number;
  beta_dsr_ceiling: number;
  min_living_allowance_nad: number;
  income_variance_threshold_pct: number;
  expenditure_plausibility_min_pct: number;
}

export type IncomeExpenditureLineCode =
  | "INC_BASIC" | "INC_BENEFITS" | "INC_RENTAL" | "INC_DEDUCT"
  | "INC_SPOUSE_GROSS" | "INC_SPOUSE_DEDUCT" | "INC_OTHER"
  | "EXP_HOUSING" | "EXP_UTILITIES" | "EXP_VEHICLE_INSTALMENT" | "EXP_VEHICLE_RUNNING"
  | "EXP_EDUCATION" | "EXP_CLOTHING" | "EXP_FOOD" | "EXP_TELECOM" | "EXP_SUBSCRIPTIONS"
  | "EXP_SECURITY" | "EXP_HOUSEKEEPING" | "EXP_ASSET_INSURANCE" | "EXP_LIFE_FUNERAL_RETIREMENT"
  | "EXP_RETAIL_CREDIT" | "EXP_OTHER";

export const EXPENDITURE_LINE_CODES: IncomeExpenditureLineCode[] = [
  "EXP_HOUSING", "EXP_UTILITIES", "EXP_VEHICLE_INSTALMENT", "EXP_VEHICLE_RUNNING",
  "EXP_EDUCATION", "EXP_CLOTHING", "EXP_FOOD", "EXP_TELECOM", "EXP_SUBSCRIPTIONS",
  "EXP_SECURITY", "EXP_HOUSEKEEPING", "EXP_ASSET_INSURANCE", "EXP_LIFE_FUNERAL_RETIREMENT",
  "EXP_RETAIL_CREDIT", "EXP_OTHER",
];

export type IncomeExpenditureLines = Partial<Record<IncomeExpenditureLineCode, number>>;

export interface CreditHistoryObligation {
  monthlyInstalment: number;
}

export interface AssessmentInput {
  amountRequested: number;
  termMonths: number;
  productType: "once_off" | "instalment";
  nextPayDate: string | null; // ISO date
  applicationSubmittedDate: string; // ISO date, for R-14 reference
  maritalStatus: "single" | "married_in_cop" | "married_out_of_cop";
  dependantsCount: number;
  lines: IncomeExpenditureLines;
  creditHistory: CreditHistoryObligation[];
  bureauObligationsTotal?: number; // manual bureau capture, if performed (FR-BUR-01)
  evidence: {
    idAccepted: boolean;
    payslipAvailable: boolean;
    payslipAcceptedOrAlternativeAgreed: boolean;
    bankStatementAccepted: boolean;
  };
  incomeVarianceKnown: boolean; // false in the pilot — no extraction to compare against (R-12)
  declaredVsEvidencedVariancePct: number | null;
  hasOtherLiveApplication: boolean; // R-15
  bureauSubmissionAttempted: boolean;
  bureauConsentRecorded: boolean;
}

export interface ComputedFigures {
  A: number; // applicant net salary
  B: number; // spouse net salary (0 unless married in COP)
  C: number; // other net income
  D: number; // total net income = A+B+C
  E: number; // total expenditure
  S: number; // surplus = D - E
  O: number; // existing obligations
  I: number; // proposed instalment / single repayment
  DSR: number; // (O+I)/D
  financeCharge: number;
  totalRepayable: number;
}

export interface RuleResult {
  id: RuleId;
  label: string;
  type: RuleType;
  passed: boolean;
  flagged: boolean; // true for Control-type "flag for human confirmation" outcomes
  detail: string;
  overridable: boolean;
}

export interface AssessmentResult {
  engineVersion: string;
  policyParamsUsed: PolicyParams;
  figures: ComputedFigures;
  rules: RuleResult[];
  rulesPassed: RuleResult[];
  rulesFailed: RuleResult[];
  rulesFlagged: RuleResult[];
  bindingConstraint: RuleResult | null;
  hasRegulatoryFailure: boolean;
  recommendedOutcome: "approve" | "decline";
  maxAffordablePrincipal: number | null;
}
