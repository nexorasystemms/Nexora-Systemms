import type { LoanParameters } from "./loan-parameters.js";
import { defaultLoanParameters } from "./default-parameters.js";

export function getLoanParameters(): LoanParameters {
  return defaultLoanParameters;
}