import { describe, expect, it } from "vitest";
import { evaluateR13 } from "../src/deterministic/rules/r13-expenditure-plausibility.js";
import { getLoanParameters } from "../src/deterministic/parameters/parameter-provider.js";

describe("R13 - Expenditure Plausibility", () => {
  const parameters = getLoanParameters();

  it("should pass when expenditure is above 40% of income", () => {
    const result = evaluateR13(
      {
        declaredIncome: 15000,
        declaredExpenditure: 7000,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass at exactly 40%", () => {
    const result = evaluateR13(
      {
        declaredIncome: 15000,
        declaredExpenditure: 6000,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should flag when expenditure is below 40%", () => {
    const result = evaluateR13(
      {
        declaredIncome: 15000,
        declaredExpenditure: 5000,
      },
      parameters
    );

    expect(result.status).toBe("FLAG");
  });

  it("should flag when income is zero", () => {
    const result = evaluateR13(
      {
        declaredIncome: 0,
        declaredExpenditure: 5000,
      },
      parameters
    );

    expect(result.status).toBe("FLAG");
  });
});