import { describe, expect, it } from "vitest";
import { defaultRuleset } from "../src/deterministic/parameters/default-ruleset.js";

describe("Ruleset", () => {
  it("returns the current ruleset metadata", () => {
    expect(defaultRuleset.version).toBe("2026-09-01");
    expect(defaultRuleset.effectiveFrom).toBe("2026-09-01");
    expect(defaultRuleset.name).toBe("CashLoan Pilot Ruleset");
  });
});
