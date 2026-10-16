import type { LoanApplicationInput } from "../deterministic/schemas/application.js";

// Maps what the TMU portal stores in Supabase onto the engine's LoanApplicationInput.
// Pricing and field meanings mirror the web app (BorrowerApplyPage.tsx / src/lib/rules-engine).

export const TMU_PRIME_RATE = 0.1075;
const SHORT_TERM_MAX_MONTHS = 5;
const SHORT_TERM_CHARGE_PCT = 0.3;
const LONG_TERM_PRIME_MULTIPLIER = 2;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Same indicative pricing the borrower is shown on the apply page. */
export function tmuPricing(amount: number, termMonths: number) {
  const short = termMonths <= SHORT_TERM_MAX_MONTHS;
  const financeCharge = short
    ? round2(amount * SHORT_TERM_CHARGE_PCT)
    : round2(amount * TMU_PRIME_RATE * LONG_TERM_PRIME_MULTIPLIER * (termMonths / 12));
  const totalRepayable = round2(amount + financeCharge);
  const instalment = round2(totalRepayable / termMonths);
  // Annualised add-on rate; for short loans this is not subject to R04.
  const effectiveRate =
    amount > 0 ? Math.round((financeCharge / amount / (termMonths / 12)) * 1e6) / 1e6 : 0;
  return { financeCharge, totalRepayable, instalment, effectiveRate };
}

export interface TmuSnapshot {
  application: {
    id: string;
    amount_requested: number | string;
    term_months: number;
    product_type: "once_off" | "instalment";
    loan_product: string | null;
    next_pay_date: string | null;
  };
  applicant: { id: string; marital_status: string; dependants_count: number };
  employment: { monthly_net_salary: number | string | null } | null;
  incomeLines: { line_code: string; amount: number | string }[];
  creditHistory: { monthly_instalment: number | string }[];
  bureauLookups: { obligations_found: unknown }[];
  documents: { doc_type: string; status: string }[];
  consents: { consent_type: string; granted: boolean; withdrawn_at?: string | null }[];
  otherApplications: { id: string; status: string }[];
  /** Net salary read from the payslip by document extraction, if available. */
  extractedNetSalary?: number | null;
}

const FINISHED_STATUSES = ["settled", "declined", "withdrawn"];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function lineAmount(lines: TmuSnapshot["incomeLines"], code: string): number {
  return num(lines.find((l) => l.line_code === code)?.amount);
}

/** Sum monthly instalments found by a bureau lookup (items shaped like { monthly_instalment }). */
function bureauObligationsTotal(lookups: TmuSnapshot["bureauLookups"]): number {
  let total = 0;
  for (const lookup of lookups) {
    if (!Array.isArray(lookup.obligations_found)) continue;
    for (const item of lookup.obligations_found as Record<string, unknown>[]) {
      total += num(item?.monthly_instalment ?? item?.instalment);
    }
  }
  return round2(total);
}

export function buildEngineInput(s: TmuSnapshot): LoanApplicationInput {
  const amount = num(s.application.amount_requested);
  const term = s.application.term_months;
  const pricing = tmuPricing(amount, term);

  const docTypes = new Set(s.documents.map((d) => d.doc_type));
  const hasAny = s.documents.length > 0;
  const allAccepted = hasAny && s.documents.every((d) => d.status === "reviewed_accepted");

  const marriedInCop = s.applicant.marital_status === "married_in_cop";
  const declaredNet =
    num(s.employment?.monthly_net_salary) || lineAmount(s.incomeLines, "net_salary");

  const bureauGranted = s.consents.some(
    (c) => c.consent_type === "bureau_enquiry_and_submission" && c.granted && !c.withdrawn_at,
  );
  // R16 only bites when a bureau submission happens; only the first-time product runs a credit check.
  const bureauSubmissionAttempted = s.application.loan_product === "first_time_credit_check";

  const declaredObligations = round2(s.creditHistory.reduce((sum, c) => sum + num(c.monthly_instalment), 0));

  return {
    applicationId: s.application.id,

    loanAmount: amount,
    termMonths: term,

    totalFinanceCharges: pricing.financeCharge,
    effectiveRate: pricing.effectiveRate,
    primeRate: TMU_PRIME_RATE,

    // Origination-time assessment: nothing has defaulted yet (R05/R06 are enforced by the arrears job).
    outstandingAmount: 0,
    defaultCharges: 0,
    daysPastDue: 0,

    incomeA: declaredNet,
    incomeB: marriedInCop ? lineAmount(s.incomeLines, "spouse_net") : 0,
    incomeC: lineAmount(s.incomeLines, "other_income"),
    monthlyExpenditure: lineAmount(s.incomeLines, "total_expenditure"),

    declaredLoanObligations: declaredObligations,
    bureauLoanObligations: bureauObligationsTotal(s.bureauLookups),

    proposedInstalment: pricing.instalment,
    dependants: s.applicant.dependants_count ?? 0,

    idPresent: docTypes.has("id"),
    payslipPresent: docTypes.has("payslip"),
    employerConfirmationPresent: docTypes.has("alternative_income_evidence"),
    bankStatementPresent: docTypes.has("bank_statement") || docTypes.has("bank_confirmation"),
    evidenceAccepted: allAccepted,

    declaredNetSalary: declaredNet,
    extractedNetSalary: s.extractedNetSalary ?? undefined,

    onceOffPaydayProduct: s.application.product_type === "once_off",
    // Once-off loans are repaid in one EFT on the date the borrower gave as "first repayment date".
    proposedDueDate: s.application.next_pay_date ?? undefined,
    declaredNextPayDate: s.application.next_pay_date ?? undefined,

    hasLiveApplicationOrUnsettledLoan: s.otherApplications.some(
      (a) => a.id !== s.application.id && !FINISHED_STATUSES.includes(a.status),
    ),

    bureauConsentRecorded: !bureauSubmissionAttempted || bureauGranted,
  };
}
