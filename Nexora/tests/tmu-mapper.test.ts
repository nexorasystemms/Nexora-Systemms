import { describe, expect, it } from "vitest";
import { evaluateApplication } from "../src/deterministic/engine/rule-engine.js";
import { buildEngineInput, tmuPricing, type TmuSnapshot } from "../src/integrations/tmu-mapper.js";
import { toFormFields } from "../src/documents/form-fields.js";
import { SCHEMAS, parseModelJson } from "../src/documents/specs.js";

function snapshot(overrides: Partial<TmuSnapshot> = {}): TmuSnapshot {
  return {
    application: {
      id: "app-1",
      amount_requested: 2000,
      term_months: 1,
      product_type: "once_off",
      loan_product: "personal_no_payslip",
      next_pay_date: "2026-11-25",
    },
    applicant: { id: "p-1", marital_status: "single", dependants_count: 1 },
    employment: { monthly_net_salary: 12000 },
    incomeLines: [
      { line_code: "other_income", amount: 0 },
      { line_code: "total_expenditure", amount: 6000 },
    ],
    creditHistory: [],
    bureauLookups: [],
    documents: [
      { doc_type: "id", status: "reviewed_accepted" },
      { doc_type: "payslip", status: "reviewed_accepted" },
      { doc_type: "bank_statement", status: "reviewed_accepted" },
    ],
    consents: [],
    otherApplications: [{ id: "app-1", status: "submitted" }],
    ...overrides,
  };
}

describe("tmuPricing (matches the apply page)", () => {
  it("charges 30% flat for terms of 5 months or less", () => {
    const p = tmuPricing(4000, 1);
    expect(p.financeCharge).toBe(1200);
    expect(p.totalRepayable).toBe(5200);
    expect(p.instalment).toBe(5200);
  });

  it("uses 2x prime add-on for longer terms and lands exactly on the R04 cap", () => {
    const p = tmuPricing(10000, 12);
    expect(p.financeCharge).toBe(2150);
    expect(p.instalment).toBe(1012.5);
    expect(p.effectiveRate).toBeLessThanOrEqual(0.215);
  });
});

describe("buildEngineInput", () => {
  it("passes every rule for an affordable, fully evidenced once-off loan", () => {
    const result = evaluateApplication(buildEngineInput(snapshot()));
    expect(result.status).toBe("PASS");
  });

  it("ignores spouse income unless married in community of property", () => {
    const lines = [{ line_code: "spouse_net", amount: 5000 }];
    expect(buildEngineInput(snapshot({ incomeLines: lines })).incomeB).toBe(0);
    expect(
      buildEngineInput(
        snapshot({ incomeLines: lines, applicant: { id: "p", marital_status: "married_in_cop", dependants_count: 0 } }),
      ).incomeB,
    ).toBe(5000);
  });

  it("requires bureau consent only for the first-time credit-check product", () => {
    expect(buildEngineInput(snapshot()).bureauConsentRecorded).toBe(true);
    const firstTime = snapshot({
      application: { ...snapshot().application, loan_product: "first_time_credit_check" },
    });
    expect(buildEngineInput(firstTime).bureauConsentRecorded).toBe(false);
    const withConsent = { ...firstTime, consents: [{ consent_type: "bureau_enquiry_and_submission", granted: true }] };
    expect(buildEngineInput(withConsent).bureauConsentRecorded).toBe(true);
  });

  it("flags a concurrent application but not the application itself", () => {
    const other = snapshot({ otherApplications: [{ id: "app-1", status: "submitted" }, { id: "app-0", status: "performing" }] });
    expect(buildEngineInput(other).hasLiveApplicationOrUnsettledLoan).toBe(true);
    const settled = snapshot({ otherApplications: [{ id: "app-1", status: "submitted" }, { id: "app-0", status: "settled" }] });
    expect(buildEngineInput(settled).hasLiveApplicationOrUnsettledLoan).toBe(false);
  });

  it("holds evidence incomplete until every document is accepted", () => {
    const pending = snapshot({ documents: [{ doc_type: "id", status: "pending" }, { doc_type: "payslip", status: "reviewed_accepted" }, { doc_type: "bank_statement", status: "reviewed_accepted" }] });
    const result = evaluateApplication(buildEngineInput(pending));
    expect(result.policyFailures).toContain("R11");
    expect(result.status).toBe("REVIEW");
  });

  it("flags income variance when the payslip disagrees with the declared salary", () => {
    const input = buildEngineInput(snapshot({ extractedNetSalary: 8000 }));
    expect(evaluateApplication(input).controlFlags).toContain("R12");
  });
});

describe("document extraction mapping", () => {
  it("maps payslip fields onto TMU form field names", () => {
    const parsed = SCHEMAS.payslip.parse({
      employerName: "Namibia Breweries",
      netSalary: "N$ 12,450.50",
      grossSalary: 15000,
      employmentStartDate: "2019-03-01",
      occupation: null,
    });
    expect(toFormFields("payslip", parsed)).toEqual({
      employerName: "Namibia Breweries",
      monthlyNetSalary: 12450.5,
      grossSalary: 15000,
      employmentStartDate: "2019-03-01",
    });
  });

  it("keeps digits only for account numbers and rejects malformed dates", () => {
    const parsed = SCHEMAS.bank_statement.parse({ bankName: "FNB", accountHolder: "J Shipanga", branch: "282672", accountNumber: "62 123-456 789" });
    expect(parsed.accountNumber).toBe("62123456789");
    expect(SCHEMAS.id.parse({ fullName: "A", idNumber: "1", dateOfBirth: "12/03/1990" }).dateOfBirth).toBeNull();
  });

  it("extracts JSON from chatty or thinking model output", () => {
    expect(parseModelJson('<think>hmm</think>Here: {"a":1} done')).toEqual({ a: 1 });
    expect(() => parseModelJson("no json")).toThrow();
  });
});
