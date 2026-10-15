import type { LoanParameters } from "./loan-parameters.js";

export const defaultLoanParameters: LoanParameters = {
  version: "2026-09-01",
  effectiveFrom: "2026-09-01",

  maximumLoanAmount: 100000,
  maximumTermMonths: 60,

  shortTermFinanceChargeRate: 0.30,
  shortTermMaximumMonths: 5,

  // SRS suggested policy parameters
  alphaInstalmentCoverage: 0.60,
  betaDebtServiceRatio: 0.35,

  // Aligned with TMU seed values (supabase/migrations/0006_seed_policy_params.sql); confirm in writing with TMU
  minimumLivingAllowance: 1500,

  incomeVarianceTolerance: 0.10,
  minimumExpenditureRatio: 0.40,
// remind these
  // Must be confirmed/configured from the applicable regulatory/client parameter
  penaltyCapRate: 0.30,

  // Explicitly defined by the SRS
  penaltyDurationDays: 90,
  
};