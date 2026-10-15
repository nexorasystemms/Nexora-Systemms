import { describe, expect, it } from "vitest";
import { evaluateR10 } from "../src/deterministic/rules/r10-dependant-floor.js";

describe("R10 - Dependant Floor", () => {
  it("should pass when remaining income is above the living allowance floor", () => {
    const result = evaluateR10({
      disposableIncome: 9000,
      proposedInstalment: 2000,
      livingAllowanceFloor: 3000,
    });

    expect(result.status).toBe("PASS");
    expect(result.value).toBe(7000);
    expect(result.threshold).toBe(3000);
  });

  it("should pass when remaining income exactly equals the living allowance floor", () => {
    const result = evaluateR10({
      disposableIncome: 5000,
      proposedInstalment: 2000,
      livingAllowanceFloor: 3000,
    });

    expect(result.status).toBe("PASS");
  });

  it("should fail when remaining income is below the living allowance floor", () => {
    const result = evaluateR10({
      disposableIncome: 4000,
      proposedInstalment: 2000,
      livingAllowanceFloor: 3000,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should be an overridable policy rule", () => {
    const result = evaluateR10({
      disposableIncome: 4000,
      proposedInstalment: 2000,
      livingAllowanceFloor: 3000,
    });

    expect(result.category).toBe("POLICY");
    expect(result.overridable).toBe(true);
  });
});
