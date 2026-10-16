import { describe, expect, it } from "vitest";
import { evaluateR09 } from "../src/deterministic/rules/r09-debt-service-ratio.js";
import { getLoanParameters } from "../src/deterministic/parameters/parameter-provider.js";

describe("R09 - Debt-Service Ratio", () => {
  const parameters = getLoanParameters();

  it("should pass when DSR is below the configured limit", () => {
    const result = evaluateR09(
      {
        debtServiceRatio: 0.30,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should pass when DSR equals the configured limit", () => {
    const result = evaluateR09(
      {
        debtServiceRatio: 0.35,
      },
      parameters
    );

    expect(result.status).toBe("PASS");
  });

  it("should fail when DSR exceeds the configured limit", () => {
    const result = evaluateR09(
      {
        debtServiceRatio: 0.36,
      },
      parameters
    );

    expect(result.status).toBe("FAIL");
  });

  it("should be an overridable policy rule", () => {
    const result = evaluateR09(
      {
        debtServiceRatio: 0.50,
      },
      parameters
    );

    expect(result.category).toBe("POLICY");
    expect(result.overridable).toBe(true);
  });
});
