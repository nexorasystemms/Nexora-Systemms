import { describe, expect, it } from "vitest";
import { evaluateR07 } from "../src/deterministic/rules/r07-positive-surplus.js";

describe("R07 - Positive Surplus", () => {
  it("should pass when disposable income is positive", () => {
    const result = evaluateR07({
      disposableIncome: 5000,
    });

    expect(result.status).toBe("PASS");
    expect(result.value).toBe(5000);
    expect(result.threshold).toBe(0);
  });

  it("should fail when disposable income is zero", () => {
    const result = evaluateR07({
      disposableIncome: 0,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should fail when disposable income is negative", () => {
    const result = evaluateR07({
      disposableIncome: -1000,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should be an overridable policy rule", () => {
    const result = evaluateR07({
      disposableIncome: -1000,
    });

    expect(result.category).toBe("POLICY");
    expect(result.overridable).toBe(true);
  });
});
