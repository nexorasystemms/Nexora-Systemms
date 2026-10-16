import type {RuleResult} from "../schemas/rule-result.js";
import type { LoanParameters } from "../parameters/loan-parameters.js";

export interface TemCeilingInput {
    termMonths: number;
}

export function evaluateR02 (
    input: TemCeilingInput, 
    parameters: LoanParameters
): RuleResult {
    const passed =
    input.termMonths <= parameters.maximumTermMonths;

    return {
        ruleId: "R02",
        category: "REGULATORY",
        status: passed ? "PASS" : "FAIL",

        value: input.termMonths,
        threshold: parameters.maximumTermMonths,
        explanation: passed
            ? `Term of ${input.termMonths} months is within the maximum allowed term of ${parameters.maximumTermMonths} months.`
            : `Term of ${input.termMonths} months exceeds the maximum allowed term of ${parameters.maximumTermMonths} months.`,

        overridable: false,
    };
}