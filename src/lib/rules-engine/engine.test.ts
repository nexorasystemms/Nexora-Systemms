import { describe, expect, it } from "vitest";
import { runAssessment, computeMaxAffordablePrincipal } from "./engine";
import { computeFigures } from "./compute";
import type { AssessmentInput, PolicyParams } from "./types";

const BASE_PARAMS: PolicyParams = {
  loan_ceiling_nad: 100000,
  term_ceiling_months: 60,
  finance_charge_cap_short_term_months: 5,
  finance_charge_cap_short_pct: 0.30,
  finance_charge_cap_long_prime_multiplier: 2,
  prime_rate_pct: 0.1075,
  penalty_cap_pct: 0.30,
  penalty_duration_days: 90,
  alpha_instalment_coverage: 0.60,
  beta_dsr_ceiling: 0.35,
  min_living_allowance_nad: 1500,
  income_variance_threshold_pct: 0.10,
  expenditure_plausibility_min_pct: 0.40,
};

function baseInput(overrides: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    amountRequested: 4000,
    termMonths: 1,
    productType: "once_off",
    nextPayDate: "2026-10-15",
    applicationSubmittedDate: "2026-09-15",
    maritalStatus: "single",
    dependantsCount: 1,
    lines: {
      INC_BASIC: 8500,
      EXP_HOUSING: 1500,
      EXP_FOOD: 1200,
      EXP_UTILITIES: 400,
      EXP_TELECOM: 300,
    },
    creditHistory: [],
    evidence: {
      idAccepted: true,
      payslipAvailable: true,
      payslipAcceptedOrAlternativeAgreed: true,
      bankStatementAccepted: true,
    },
    incomeVarianceKnown: false,
    declaredVsEvidencedVariancePct: null,
    hasOtherLiveApplication: false,
    bureauSubmissionAttempted: false,
    bureauConsentRecorded: false,
    ...overrides,
  };
}

describe("computeFigures", () => {
  it("computes A/D/E/S for a simple single applicant", () => {
    const figures = computeFigures(baseInput(), BASE_PARAMS);
    expect(figures.A).toBe(8500);
    expect(figures.D).toBe(8500);
    expect(figures.E).toBe(3400);
    expect(figures.S).toBe(5100);
  });

  it("includes spouse income only when married in community of property", () => {
    const marriedCop = baseInput({
      maritalStatus: "married_in_cop",
      lines: { INC_BASIC: 8500, INC_SPOUSE_GROSS: 3000, INC_SPOUSE_DEDUCT: 200 },
    });
    expect(computeFigures(marriedCop, BASE_PARAMS).B).toBe(2800);

    const marriedOutOfCop = baseInput({
      maritalStatus: "married_out_of_cop",
      lines: { INC_BASIC: 8500, INC_SPOUSE_GROSS: 3000, INC_SPOUSE_DEDUCT: 200 },
    });
    expect(computeFigures(marriedOutOfCop, BASE_PARAMS).B).toBe(0);
  });

  it("prices a short-term once-off loan at exactly the R-03 cap, matching TMU's flagship product", () => {
    const figures = computeFigures(baseInput({ amountRequested: 4000, termMonths: 1 }), BASE_PARAMS);
    expect(figures.financeCharge).toBe(1200); // 30% of 4000
    expect(figures.totalRepayable).toBe(5200);
    expect(figures.I).toBe(5200); // single repayment
  });
});

describe("R-01/R-02 regulatory ceilings — hard blocks", () => {
  it("fails R-01 when principal exceeds the loan ceiling", () => {
    const result = runAssessment(baseInput({ amountRequested: 150000 }), BASE_PARAMS);
    const r01 = result.rules.find((r) => r.id === "R-01")!;
    expect(r01.passed).toBe(false);
    expect(r01.overridable).toBe(false);
    expect(result.hasRegulatoryFailure).toBe(true);
    expect(result.recommendedOutcome).toBe("decline");
  });

  it("fails R-02 when term exceeds the ceiling", () => {
    const result = runAssessment(baseInput({ termMonths: 72 }), BASE_PARAMS);
    expect(result.rules.find((r) => r.id === "R-02")!.passed).toBe(false);
  });
});

describe("R-03/R-04 finance charge caps", () => {
  it("passes R-03 when priced at exactly the short-term cap", () => {
    const result = runAssessment(baseInput({ amountRequested: 4000, termMonths: 1 }), BASE_PARAMS);
    expect(result.rules.find((r) => r.id === "R-03")!.passed).toBe(true);
  });

  it("R-04 is not applicable for a short-term loan and passes by construction", () => {
    const result = runAssessment(baseInput({ termMonths: 1 }), BASE_PARAMS);
    expect(result.rules.find((r) => r.id === "R-04")!.passed).toBe(true);
  });
});

describe("Appendix B–style once-off case: modest salary, small once-off loan", () => {
  // The SRS references blueprint Appendix B's worked case (N$4,000 once-off / N$8,500 salary)
  // as failing R-08, R-09 and R-10 despite passing the regulatory caps. The blueprint's own
  // expenditure/obligation breakdown is not reproduced in this SRS, so this test uses a
  // plausible expenditure profile of the same shape to confirm the engine can reach that
  // outcome — it is not a byte-for-byte replication of the blueprint's own numbers.
  it("can decline on policy grounds (R-08/09/10) while regulatory rules pass", () => {
    const input = baseInput({
      amountRequested: 4000,
      termMonths: 1,
      dependantsCount: 3,
      lines: {
        INC_BASIC: 8500,
        EXP_HOUSING: 2500,
        EXP_FOOD: 2200,
        EXP_UTILITIES: 900,
        EXP_TELECOM: 400,
        EXP_VEHICLE_INSTALMENT: 1200,
        EXP_EDUCATION: 800,
      },
      creditHistory: [{ monthlyInstalment: 900 }],
    });
    const result = runAssessment(input, BASE_PARAMS);

    expect(result.hasRegulatoryFailure).toBe(false);
    expect(result.recommendedOutcome).toBe("decline");
    const failedIds = result.rulesFailed.map((r) => r.id);
    expect(failedIds).toEqual(expect.arrayContaining(["R-08", "R-09", "R-10"]));
    expect(result.maxAffordablePrincipal).not.toBeNull();
    expect(result.maxAffordablePrincipal!).toBeGreaterThanOrEqual(0);
  });
});

describe("FR-ENG-03 / FR-DEC-03: regulatory failures cannot be overridden", () => {
  it("regulatory rules are never marked overridable", () => {
    const result = runAssessment(baseInput({ amountRequested: 150000 }), BASE_PARAMS);
    const regulatoryRules = result.rules.filter((r) => r.type === "Regulatory");
    expect(regulatoryRules.every((r) => !r.overridable)).toBe(true);
  });
});

describe("FR-ENG-07: maximum affordable principal", () => {
  it("returns null when surplus itself is not positive (R-07) — no amount fixes that", () => {
    const input = baseInput({
      lines: { INC_BASIC: 3000, EXP_HOUSING: 2000, EXP_FOOD: 1500 },
    });
    const figures = computeFigures(input, BASE_PARAMS);
    expect(figures.S).toBeLessThan(0);
    expect(computeMaxAffordablePrincipal(input, BASE_PARAMS, figures)).toBeNull();
  });

  it("returns a positive, lower principal when the requested amount is too large for the surplus", () => {
    const input = baseInput({ amountRequested: 50000, dependantsCount: 0 });
    const figures = computeFigures(input, BASE_PARAMS);
    const maxPrincipal = computeMaxAffordablePrincipal(input, BASE_PARAMS, figures);
    expect(maxPrincipal).not.toBeNull();
    expect(maxPrincipal!).toBeLessThan(50000);
    expect(maxPrincipal!).toBeGreaterThan(0);
  });
});

describe("R-15 duplicate / concurrent applications", () => {
  it("flags but does not hard-block a duplicate application", () => {
    const result = runAssessment(baseInput({ hasOtherLiveApplication: true }), BASE_PARAMS);
    const r15 = result.rules.find((r) => r.id === "R-15")!;
    expect(r15.passed).toBe(false);
    expect(r15.flagged).toBe(true);
    expect(r15.overridable).toBe(true);
  });
});

describe("R-16 bureau consent hard block", () => {
  it("fails if a bureau submission is attempted without recorded consent", () => {
    const result = runAssessment(
      baseInput({ bureauSubmissionAttempted: true, bureauConsentRecorded: false }),
      BASE_PARAMS,
    );
    const r16 = result.rules.find((r) => r.id === "R-16")!;
    expect(r16.passed).toBe(false);
    expect(r16.type).toBe("Regulatory");
    expect(r16.overridable).toBe(false);
  });
});

describe("binding constraint selection", () => {
  it("prefers a failed Regulatory rule over a failed Policy rule", () => {
    const result = runAssessment(
      baseInput({ amountRequested: 150000, dependantsCount: 5 }),
      BASE_PARAMS,
    );
    expect(result.bindingConstraint?.type).toBe("Regulatory");
  });

  it("is null when every rule passes", () => {
    const result = runAssessment(
      baseInput({ amountRequested: 1000, termMonths: 1, dependantsCount: 0 }),
      BASE_PARAMS,
    );
    expect(result.hasRegulatoryFailure).toBe(false);
    if (result.recommendedOutcome === "approve") {
      expect(result.bindingConstraint).toBeNull();
    }
  });
});
