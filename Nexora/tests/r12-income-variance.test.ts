import { describe, expect, it } from "vitest";
import { evaluateR12 } from "../src/deterministic/rules/r12-income-variance.js";
import { getLoanParameters } from "../src/deterministic/parameters/parameter-provider.js";

describe("R12 - Income Variance", () => {
  const parameters = getLoanParameters();

  it("should pass when variance is within 10%", () => {
    const result = evaluateR12(
      {
        declaredNetSalary: 15000,
        extractedNetSalary: 14000,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass at exactly 10% variance", () => {
    const result = evaluateR12(
      {
        declaredNetSalary: 15000,
        extractedNetSalary: 13500,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should flag when variance exceeds 10%", () => {
    const result = evaluateR12(
      {
        declaredNetSalary: 15000,
        extractedNetSalary: 13000,
      },
      parameters
    );

    expect(result.status).toBe("FLAG");
    expect(result.category).toBe("CONTROL");
  });

  it("should remain dormant when extracted salary is unavailable", () => {
    const result = evaluateR12(
      {
        declaredNetSalary: 15000,
        extractedNetSalary: undefined,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });
});