import { describe, expect, it } from "vitest";
import { determineAssessmentStatus } from "../src/deterministic/engine/assessment-status.js";
import type { RuleResult } from "../src/deterministic/schemas/rule-result.js";

describe("Assessment Status", () => {
  it("returns PASS when all rules pass", () => {
    const results: RuleResult[] = [
      {
        ruleId: "R01",
        category: "REGULATORY",
        status: "PASS",
        explanation: "Rule passed.",
        overridable: false,
      },
    ];

    expect(determineAssessmentStatus(results)).toBe("PASS");
  });

  it("returns FAIL when a regulatory rule fails", () => {
    const results: RuleResult[] = [
      {
        ruleId: "R01",
        category: "REGULATORY",
        status: "FAIL",
        explanation: "Rule failed.",
        overridable: false,
      },
    ];

    expect(determineAssessmentStatus(results)).toBe("FAIL");
  });

  it("returns REVIEW when a policy rule fails", () => {
    const results: RuleResult[] = [
      {
        ruleId: "R02",
        category: "POLICY",
        status: "FAIL",
        explanation: "Policy rule failed.",
        overridable: true,
      },
    ];

    expect(determineAssessmentStatus(results)).toBe("REVIEW");
  });

  it("returns REVIEW when a control rule is flagged", () => {
    const results: RuleResult[] = [
      {
        ruleId: "R03",
        category: "CONTROL",
        status: "FLAG",
        explanation: "Human review required.",
        overridable: true,
      },
    ];

    expect(determineAssessmentStatus(results)).toBe("REVIEW");
  });
});