import { describe, expect, it } from "vitest";
import { evaluateR05 } from "../src/deterministic/rules/r05-penalty-cap.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";

describe("R05 - Penalty Cap", () => {
  it("should pass when default charges are within the configured cap", () => {
    const parameters = {
      ...defaultLoanParameters,
      penaltyCapRate: 0.10,
    };

    const result = evaluateR05(
      {
        outstandingAmount: 10000,
        defaultCharges: 1000,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail when default charges exceed the cap", () => {
    const parameters = {
      ...defaultLoanParameters,
      penaltyCapRate: 0.10,
    };

    const result = evaluateR05(
      {
        outstandingAmount: 10000,
        defaultCharges: 1001,
      },
      parameters
    );

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });
});