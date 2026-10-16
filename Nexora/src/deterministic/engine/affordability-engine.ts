import type { LoanApplicationInput } from "../schemas/application.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface AffordabilityCalculation {
  totalIncome: number;
  disposableIncome: number;
  existingLoanObligations: number;
  proposedInstalment: number;
  debtServiceRatio: number;
  coverageLimit: number;
  livingAllowanceFloor: number;
}

export function calculateAffordability(
  input: LoanApplicationInput,
  parameters: LoanParameters
): AffordabilityCalculation {
  // D = A + B + C
  const totalIncome =
    input.incomeA +
    input.incomeB +
    input.incomeC;

  // S = D - E
  const disposableIncome =
    totalIncome - input.monthlyExpenditure;

  // O = higher of declared and bureau obligations
  const existingLoanObligations = Math.max(
    input.declaredLoanObligations,
    input.bureauLoanObligations
  );

  // I = proposed instalment
  const proposedInstalment =
    input.proposedInstalment;

  // DSR = (O + I) / D
  const debtServiceRatio =
    totalIncome > 0
      ? (existingLoanObligations + proposedInstalment) /
        totalIncome
      : Infinity;

  // R08
  const coverageLimit =
    parameters.alphaInstalmentCoverage *
    disposableIncome;

  // R10
  const livingAllowanceFloor =
    parameters.minimumLivingAllowance *
    (1 + input.dependants);

  return {
    totalIncome,
    disposableIncome,
    existingLoanObligations,
    proposedInstalment,
    debtServiceRatio,
    coverageLimit,
    livingAllowanceFloor,
  };
}