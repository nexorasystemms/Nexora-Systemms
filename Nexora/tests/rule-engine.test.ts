import { describe, expect, it } from "vitest";
import { evaluateApplication } from "../src/deterministic/engine/rule-engine.js";

describe("Loan Rule Engine", () => {
  it("returns PASS when all registered rules pass", () => {
    const result = evaluateApplication({
      applicationId: "APP-001",

      // Loan request
      loanAmount: 8000,
      termMonths: 12,

      // Finance charge assessment
      totalFinanceCharges: 1000,
      effectiveRate: 0.15,
      primeRate: 0.10,

      // Default / penalty assessment
      outstandingAmount: 8000,
      defaultCharges: 0,
      daysPastDue: 0,

      // Affordability
      incomeA: 15000,
      incomeB: 0,
      incomeC: 0,
      monthlyExpenditure: 6000,

      // Existing debt obligations
      declaredLoanObligations: 1000,
      bureauLoanObligations: 1000,

      // Proposed new loan
      proposedInstalment: 2000,

      // Household
      dependants: 0,

      // R11 - Evidence
      idPresent: true,
      payslipPresent: true,
      employerConfirmationPresent: false,
      bankStatementPresent: true,
      evidenceAccepted: true,

      // R12 - Income variance
      declaredNetSalary: 15000,
      extractedNetSalary: undefined,

      // R14 - Maturity alignment
      onceOffPaydayProduct: false,
      proposedDueDate: undefined,
      declaredNextPayDate: undefined,

      // R15 - Duplicate / concurrent
      hasLiveApplicationOrUnsettledLoan: false,

      // R16 - Bureau consent
      bureauConsentRecorded: true,
    });

    // Overall result
    expect(result.status).toBe("PASS");

    // All R01-R16 execute
    expect(result.rules).toHaveLength(16);

    // R01
    expect(result.rules[0].ruleId).toBe("R01");
    expect(result.rules[0].status).toBe("PASS");

    // R02
    expect(result.rules[1].ruleId).toBe("R02");
    expect(result.rules[1].status).toBe("PASS");

    // R03
    expect(result.rules[2].ruleId).toBe("R03");
    expect(result.rules[2].status).toBe("PASS");

    // R04
    expect(result.rules[3].ruleId).toBe("R04");
    expect(result.rules[3].status).toBe("PASS");

    // R05
    expect(result.rules[4].ruleId).toBe("R05");
    expect(result.rules[4].status).toBe("PASS");

    // R06
    expect(result.rules[5].ruleId).toBe("R06");
    expect(result.rules[5].status).toBe("PASS");

    // R07
    expect(result.rules[6].ruleId).toBe("R07");
    expect(result.rules[6].status).toBe("PASS");

    // R08
    expect(result.rules[7].ruleId).toBe("R08");
    expect(result.rules[7].status).toBe("PASS");

    // R09
    expect(result.rules[8].ruleId).toBe("R09");
    expect(result.rules[8].status).toBe("PASS");

    // R10
    expect(result.rules[9].ruleId).toBe("R10");
    expect(result.rules[9].status).toBe("PASS");

    // R11
    expect(result.rules[10].ruleId).toBe("R11");
    expect(result.rules[10].status).toBe("PASS");

    // R12
    expect(result.rules[11].ruleId).toBe("R12");
    expect(result.rules[11].status).toBe("PASS");

    // R13
    expect(result.rules[12].ruleId).toBe("R13");
    expect(result.rules[12].status).toBe("PASS");

    // R14
    expect(result.rules[13].ruleId).toBe("R14");
    expect(result.rules[13].status).toBe("PASS");

    // R15
    expect(result.rules[14].ruleId).toBe("R15");
    expect(result.rules[14].status).toBe("PASS");

    // R16
    expect(result.rules[15].ruleId).toBe("R16");
    expect(result.rules[15].status).toBe("PASS");

    // No regulatory hard blocks
    expect(result.hardBlocks).toHaveLength(0);

    // No policy failures
    expect(result.policyFailures).toHaveLength(0);

    // No control flags
    expect(result.controlFlags).toHaveLength(0);

    // Affordability calculations
    expect(result.calculatedValues.totalIncome).toBe(15000);

    expect(result.calculatedValues.disposableIncome).toBe(9000);

    expect(
      result.calculatedValues.existingLoanObligations
    ).toBe(1000);

    expect(
      result.calculatedValues.proposedInstalment
    ).toBe(2000);

    // DSR = (O + I) / D
    // = (1000 + 2000) / 15000
    // = 0.20
    expect(
      result.calculatedValues.debtServiceRatio
    ).toBeCloseTo(
      (1000 + 2000) / 15000,
      5
    );

    // R08 coverage limit = 60% × disposable income
    // = 0.60 × 9000
    // = 5400
    expect(
      result.calculatedValues.coverageLimit
    ).toBe(5400);

    // R10 living allowance floor = N$1,500 (TMU policy) x (1 + 0 dependants)
    expect(
      result.calculatedValues.livingAllowanceFloor
    ).toBe(1500);

    // Ruleset version
    expect(result.rulesetVersion).toBe("2026-09-01");
  });

  it("returns FAIL when regulatory rules fail", () => {
    const result = evaluateApplication({
      applicationId: "APP-002",

      // Deliberately violates R01 and R02
      loanAmount: 120000,
      termMonths: 61,

      // Finance charge assessment
      totalFinanceCharges: 1000,
      effectiveRate: 0.15,
      primeRate: 0.10,

      // Default / penalty assessment
      outstandingAmount: 8000,
      defaultCharges: 0,
      daysPastDue: 0,

      // Affordability
      incomeA: 15000,
      incomeB: 0,
      incomeC: 0,
      monthlyExpenditure: 6000,

      // Existing debt obligations
      declaredLoanObligations: 1000,
      bureauLoanObligations: 1000,

      // Proposed new loan
      proposedInstalment: 2000,

      // Household
      dependants: 0,

      // R11 - Evidence
      idPresent: true,
      payslipPresent: true,
      employerConfirmationPresent: true,
      bankStatementPresent: true,
      evidenceAccepted: true,

      // R12
      declaredNetSalary: 15000,
      extractedNetSalary: undefined,

      // R14
      onceOffPaydayProduct: false,
      proposedDueDate: undefined,
      declaredNextPayDate: undefined,

      // R15
      hasLiveApplicationOrUnsettledLoan: false,

      // R16
      bureauConsentRecorded: true,
    });

    // Regulatory failure means overall FAIL
    expect(result.status).toBe("FAIL");

    // All R01-R16 still execute
    expect(result.rules).toHaveLength(16);

    // R01
    expect(result.rules[0].ruleId).toBe("R01");
    expect(result.rules[0].status).toBe("FAIL");

    // R02
    expect(result.rules[1].ruleId).toBe("R02");
    expect(result.rules[1].status).toBe("FAIL");

    // Regulatory hard blocks
    expect(result.hardBlocks).toContain("R01");
    expect(result.hardBlocks).toContain("R02");

    // R07-R10 still execute
    expect(result.rules[6].ruleId).toBe("R07");
    expect(result.rules[7].ruleId).toBe("R08");
    expect(result.rules[8].ruleId).toBe("R09");
    expect(result.rules[9].ruleId).toBe("R10");

    // R11-R16 still execute
    expect(result.rules[10].ruleId).toBe("R11");
    expect(result.rules[11].ruleId).toBe("R12");
    expect(result.rules[12].ruleId).toBe("R13");
    expect(result.rules[13].ruleId).toBe("R14");
    expect(result.rules[14].ruleId).toBe("R15");
    expect(result.rules[15].ruleId).toBe("R16");

    // R16 passes because consent was recorded
    expect(result.rules[15].status).toBe("PASS");
  });
});