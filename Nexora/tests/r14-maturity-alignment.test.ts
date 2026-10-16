import { describe, expect, it } from "vitest";
import { evaluateR14 } from "../src/deterministic/rules/r14-maturity-alignment.js";

describe("R14 - Maturity Alignment", () => {
  it("should pass when due date is before next pay date", () => {
    const result = evaluateR14({
      onceOffPaydayProduct: true,
      proposedDueDate: "2026-10-10",
      declaredNextPayDate: "2026-10-15",
    });

    expect(result.status).toBe("PASS");
  });

  it("should pass when due date equals next pay date", () => {
    const result = evaluateR14({
      onceOffPaydayProduct: true,
      proposedDueDate: "2026-10-15",
      declaredNextPayDate: "2026-10-15",
    });

    expect(result.status).toBe("PASS");
  });

  it("should flag when due date is after next pay date", () => {
    const result = evaluateR14({
      onceOffPaydayProduct: true,
      proposedDueDate: "2026-10-20",
      declaredNextPayDate: "2026-10-15",
    });

    expect(result.status).toBe("FLAG");
  });

  it("should not apply to non-payday products", () => {
    const result = evaluateR14({
      onceOffPaydayProduct: false,
      proposedDueDate: "2026-10-20",
      declaredNextPayDate: "2026-10-15",
    });

    expect(result.status).toBe("PASS");
  });

  it("should flag when required dates are missing", () => {
    const result = evaluateR14({
      onceOffPaydayProduct: true,
      proposedDueDate: undefined,
      declaredNextPayDate: undefined,
    });

    expect(result.status).toBe("FLAG");
  });
});
