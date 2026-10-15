import { describe, expect, it } from "vitest";
import { getCurrentRuleset } from "../src/deterministic/parameters/ruleset-provider.js";

describe("Ruleset Provider", () => {
  it("returns the current ruleset", () => {
    const ruleset = getCurrentRuleset();

    expect(ruleset.version).toBe("2026-09-01");
    expect(ruleset.effectiveFrom).toBe("2026-09-01");
    expect(ruleset.name).toBe("CashLoan Pilot Ruleset");
  });
});