import {describe, expect, it} from "vitest";
import { evaluateR01 } from "../src/deterministic/rules/r01-loan-principal.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";
describe("R01 - Loan Principal Ceiling", () => {
    it("should pass when loan amount is within the maximum limit", () => {
        const result = evaluateR01({ loanAmount: 8000 }, defaultLoanParameters);
        expect(result.status).toBe("PASS");
    });

    it("should fail when loan amount exceeds the maximum limit", () => {
        const result = evaluateR01({ loanAmount: 120000 }, defaultLoanParameters);
    
        expect(result.status).toBe("FAIL");
    });

    it("should pass when loan amount is equal to the maximum limit", () => {
        const result = evaluateR01({ loanAmount: 10000 }, defaultLoanParameters);
        
        expect(result.status).toBe("PASS");
    });
});

