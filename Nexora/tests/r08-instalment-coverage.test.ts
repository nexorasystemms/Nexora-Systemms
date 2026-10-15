import { describe, expect, it } from "vitest";
import { evaluateR08 } from "../src/deterministic/rules/r08-instalment-coverage.js";

describe("R08 - Instalment Coverage", () => {
  it("should pass when instalment is below the coverage limit", () => {
    const result = evaluateR08({
      proposedInstalment: 3000,
      coverageLimit: 5400,
    });

    expect(result.status).toBe("PASS");
  });

  it("should pass when instalment equals the coverage limit", () => {
    const result = evaluateR08({
      proposedInstalment: 5400,
      coverageLimit: 5400,
    });

    expect(result.status).toBe("PASS");
  });

  it("should fail when instalment exceeds the coverage limit", () => {
    const result = evaluateR08({
      proposedInstalment: 5401,
      coverageLimit: 5400,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should be an overridable policy rule", () => {
    const result = evaluateR08({
      proposedInstalment: 6000,
      coverageLimit: 5400,
    });

    expect(result.category).toBe("POLICY");
    expect(result.overridable).toBe(true);
  });
});
