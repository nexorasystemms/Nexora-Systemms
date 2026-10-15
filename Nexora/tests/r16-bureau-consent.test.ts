import { describe, expect, it } from "vitest";
import { evaluateR16 } from "../src/deterministic/rules/r16-bureau-consent.js";

describe("R16 - Bureau Consent", () => {
  it("should pass when bureau consent is recorded", () => {
    const result = evaluateR16({
      bureauConsentRecorded: true,
    });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });

  it("should fail when bureau consent is not recorded", () => {
    const result = evaluateR16({
      bureauConsentRecorded: false,
    });

    expect(result.status).toBe("FAIL");
    expect(result.category).toBe("REGULATORY");
    expect(result.overridable).toBe(false);
  });
});