import { describe, expect, it } from "vitest";
import { evaluateR15 } from "../src/deterministic/rules/r15-duplicate-concurrent.js";

describe("R15 - Duplicate / Concurrent Application", () => {
  it("should pass when no live application or unsettled loan exists", () => {
    const result = evaluateR15({
      hasLiveApplicationOrUnsettledLoan: false,
    });

    expect(result.status).toBe("PASS");
  });

  it("should flag when a live application exists", () => {
    const result = evaluateR15({
      hasLiveApplicationOrUnsettledLoan: true,
    });

    expect(result.status).toBe("FLAG");
    expect(result.category).toBe("CONTROL");
  });
});


