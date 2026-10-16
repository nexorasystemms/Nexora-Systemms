export interface LoanParameters {
  version: string;
  effectiveFrom: string;

  maximumLoanAmount: number;
  maximumTermMonths: number;

  shortTermFinanceChargeRate: number;
  shortTermMaximumMonths: number;

  alphaInstalmentCoverage: number;
  betaDebtServiceRatio: number;

  minimumLivingAllowance: number;

  incomeVarianceTolerance: number;
  minimumExpenditureRatio: number;

  penaltyCapRate: number;
  penaltyDurationDays: number;

  
}