import { describe, expect, it } from "vitest";
import { evaluateR11 } from "../src/deterministic/rules/r11-evidence-completeness.js";

describe("R11 - Evidence Completeness", () => {
  it("should pass when all required evidence is present and accepted", () => {
    const result = evaluateR11({
      idPresent: true,
      payslipPresent: true,
      employerConfirmationPresent: false,
      bankStatementPresent: true,
      evidenceAccepted: true,
    });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("POLICY");
    expect(result.overridable).toBe(true);
  });

  it("should pass when employer confirmation replaces the payslip", () => {
    const result = evaluateR11({
      idPresent: true,
      payslipPresent: false,
      employerConfirmationPresent: true,
      bankStatementPresent: true,
      evidenceAccepted: true,
    });

    expect(result.status).toBe("PASS");
  });

  it("should fail when ID is missing", () => {
    const result = evaluateR11({
      idPresent: false,
      payslipPresent: true,
      employerConfirmationPresent: false,
      bankStatementPresent: true,
      evidenceAccepted: true,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should fail when both payslip and employer confirmation are missing", () => {
    const result = evaluateR11({
      idPresent: true,
      payslipPresent: false,
      employerConfirmationPresent: false,
      bankStatementPresent: true,
      evidenceAccepted: true,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should fail when bank statement is missing", () => {
    const result = evaluateR11({
      idPresent: true,
      payslipPresent: true,
      employerConfirmationPresent: false,
      bankStatementPresent: false,
      evidenceAccepted: true,
    });

    expect(result.status).toBe("FAIL");
  });

  it("should fail when evidence has not been accepted", () => {
    const result = evaluateR11({
      idPresent: true,
      payslipPresent: true,
      employerConfirmationPresent: false,
      bankStatementPresent: true,
      evidenceAccepted: false,
    });

    expect(result.status).toBe("FAIL");
  });
});

