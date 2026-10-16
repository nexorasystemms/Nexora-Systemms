import { describe, expect, it } from "vitest";
import { getLoanParameters } from "../src/deterministic/parameters/parameter-provider.js";

describe("Loan Parameter Provider", () => {
  it("returns the current loan parameter set", () => {
    const parameters = getLoanParameters();

    expect(parameters.version).toBe("2026-09-01");
    expect(parameters.effectiveFrom).toBe("2026-09-01");
    expect(parameters.maximumLoanAmount).toBe(100000);
  });
});