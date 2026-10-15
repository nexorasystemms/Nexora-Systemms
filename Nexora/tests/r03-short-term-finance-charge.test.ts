import { describe, expect, it } from "vitest";
import { evaluateR03 } from "../src/deterministic/rules/r03-short-term-finance-charge.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";

describe("R03 - Short-Term Finance Charge Cap", () => {
  it("should pass when finance charges are within 30%", () => {
    const result = evaluateR03(
      {
        loanAmount: 10000,
        termMonths: 5,
        totalFinanceCharges: 3000,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail when finance charges exceed 30%", () => {
    const result = evaluateR03(
      {
        loanAmount: 10000,
        termMonths: 5,
        totalFinanceCharges: 3001,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });

  it("should pass at exactly 30%", () => {
    const result = evaluateR03(
      {
        loanAmount: 10000,
        termMonths: 5,
        totalFinanceCharges: 3000,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should not apply to terms longer than 5 months", () => {
    const result = evaluateR03(
      {
        loanAmount: 10000,
        termMonths: 6,
        totalFinanceCharges: 10000,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });
});