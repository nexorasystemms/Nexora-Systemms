import { describe, expect, it } from "vitest";
import { evaluateR06 } from "../src/deterministic/rules/r06-penalty-duration.js";
import { defaultLoanParameters } from "../src/deterministic/parameters/default-parameters.js";

describe("R06 - Penalty Duration", () => {
  it("should pass before 90 days", () => {
    const result = evaluateR06(
      { daysPastDue: 30 },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass at exactly 90 days", () => {
    const result = evaluateR06(
      { daysPastDue: 90 },
      defaultLoanParameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail after 90 days", () => {
    const result = evaluateR06(
      { daysPastDue: 91 },
      defaultLoanParameters
    );

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });
});