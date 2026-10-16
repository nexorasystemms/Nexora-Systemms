import { describe, expect, it } from "vitest";
import { evaluateR04 } from "../src/deterministic/rules/r04-long-term-effective-rate.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";

describe("R04 - Long-Term Effective Rate", () => {
  it("should pass when effective rate is within 2x prime", () => {
    const result = evaluateR04(
      {
        termMonths: 12,
        effectiveRate: 0.20,
        primeRate: 0.10,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass at exactly 2x prime", () => {
    const result = evaluateR04(
      {
        termMonths: 12,
        effectiveRate: 0.20,
        primeRate: 0.10,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail when effective rate exceeds 2x prime", () => {
    const result = evaluateR04(
      {
        termMonths: 12,
        effectiveRate: 0.21,
        primeRate: 0.10,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });

  it("should not apply to short-term loans", () => {
    const result = evaluateR04(
      {
        termMonths: 5,
        effectiveRate: 1.0,
        primeRate: 0.10,
      },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });
});