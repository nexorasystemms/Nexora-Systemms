import type {RuleResult} from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface LoanPrincipalInput {
    loanAmount: number;
}
export function evaluateR01(
    input: LoanPrincipalInput,
    parameters: LoanParameters): RuleResult {
        const passed = input.loanAmount <= parameters.maximumLoanAmount;

        return {
            ruleId: "R01",
            category: "REGULATORY",
            status: passed ? "PASS" : "FAIL",

            value: input.loanAmount,
            threshold: parameters.maximumLoanAmount,
            explanation: passed ? "Loan amount is within the regulatory limit." : "Loan amount exceeds the regulatory limit.",

            overridable: false,
        };
}