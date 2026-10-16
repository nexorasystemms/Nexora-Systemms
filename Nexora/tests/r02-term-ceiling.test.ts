import { describe, expect, it } from "vitest";
import { evaluateR02 } from "../src/deterministic/rules/r02-term-ceiling.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";

describe("R02 - Term Ceiling", () => {
  it("should pass when term is below the maximum", () => {
    const result = evaluateR02(
      { termMonths: 12 },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass when term equals the maximum", () => {
    const result = evaluateR02(
      { termMonths: 60 },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail when term exceeds the maximum", () => {
    const result = evaluateR02(
      { termMonths: 61 },
      defaultLoanParameters
    );

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });
});