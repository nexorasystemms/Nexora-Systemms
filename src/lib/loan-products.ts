export type LoanProductId =
  | "personal_no_payslip"
  | "first_time_credit_check"
  | "tender_purchase_order";

export type LoanProduct = {
  id: LoanProductId;
  title: string;
  badge: string;
  side?: string;
  lender: string;
  summary: string;
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  minTerm: number;
  maxTerm: number;
  defaultTerm: number;
  productType: "once_off" | "instalment";
  settlement: string;
  extraRow: [string, string];
  eligibility: string[];
  documents: { key: string; label: string; hint: string }[];
  step2Title: string;
  step2Hint: string;
  requiresEmployment: boolean;
  requiresIncomeExpenditure: boolean;
  requiresCreditHistory: boolean;
  requiresReferral: boolean;
  requiresBankDetails: boolean;
  requiresNextPayDate: boolean;
  requiresEftMandate: boolean;
  requiresCreditCheckConsent: boolean;
  requiresCollateral: boolean;
  amountStep: number;
};

export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: "personal_no_payslip",
    title: "Personal loan (no payslip)",
    badge: "1 MONTH",
    side: "TMU CashLoan CC",
    lender: "TMU CashLoan CC",
    summary:
      "Once-off personal loan repaid in a single EFT on the agreed date. No payslip is required for this facility.",
    minAmount: 500,
    maxAmount: 15000,
    defaultAmount: 4000,
    minTerm: 1,
    maxTerm: 1,
    defaultTerm: 1,
    productType: "once_off",
    settlement: "Once-off EFT — one repayment",
    extraRow: ["Payslip", "Not required"],
    eligibility: [
      "Namibian ID or valid passport",
      "Bank account in your own name for the EFT mandate",
      "Able to repay in one instalment within 1 month",
      "No payslip is required for this application",
    ],
    documents: [
      { key: "id", label: "National ID or Passport", hint: "Colour copy of Namibian ID, smart card, or valid passport" },
      { key: "proof_of_address", label: "Proof of residential address", hint: "Municipality bill, rental contract, or police declaration not older than 3 months" },
      { key: "bank_confirmation", label: "Bank account confirmation", hint: "Proof of the account that will be used for the EFT debit order" },
    ],
    step2Title: "Bank details & EFT mandate",
    step2Hint: "Repayment is a single EFT. TMU CashLoan CC processes authorised payments through the Namibian banks system.",
    requiresEmployment: false,
    requiresIncomeExpenditure: false,
    requiresCreditHistory: false,
    requiresReferral: false,
    requiresBankDetails: true,
    requiresNextPayDate: true,
    requiresEftMandate: true,
    requiresCreditCheckConsent: false,
    requiresCollateral: false,
    amountStep: 100,
  },
  {
    id: "first_time_credit_check",
    title: "First-time loan application",
    badge: "NEW CLIENTS",
    side: "Credit check required",
    lender: "TMU CashLoan CC",
    summary:
      "Application for new clients. A client credit check is required, together with employment, income and expenditure, credit history, and bank details.",
    minAmount: 500,
    maxAmount: 25000,
    defaultAmount: 5000,
    minTerm: 1,
    maxTerm: 12,
    defaultTerm: 1,
    productType: "instalment",
    settlement: "Debit order / EFT as agreed",
    extraRow: ["Credit check", "Required for new clients"],
    eligibility: [
      "New TMU CashLoan CC client",
      "Namibian ID card or passport",
      "Consent for a credit bureau / third-party credit check",
      "Employment, income and expenditure, and bank details as on the paper application",
    ],
    documents: [
      { key: "id", label: "National ID or Passport", hint: "Personal ID card or passport as marked on the application" },
      { key: "payslip", label: "Latest payslip", hint: "Required for first-time applications so salary and deductions can be verified" },
      { key: "bank_statement", label: "Bank statement", hint: "Official statement for the account named on the form" },
      { key: "proof_of_address", label: "Proof of residential address", hint: "Matches the residential address on the application" },
    ],
    step2Title: "Employment, income, credit history & bank",
    step2Hint: "Matches the TMU CashLoan CC new-client application: employment, income and expenditure, prior credit, and bank details.",
    requiresEmployment: true,
    requiresIncomeExpenditure: true,
    requiresCreditHistory: true,
    requiresReferral: true,
    requiresBankDetails: true,
    requiresNextPayDate: true,
    requiresEftMandate: true,
    requiresCreditCheckConsent: true,
    requiresCollateral: false,
    amountStep: 100,
  },
  {
    id: "tender_purchase_order",
    title: "Tender / purchase order loan",
    badge: "REQUIRES P.O.",
    side: "Supply & Delivery",
    lender: "TMU Supply and Delivery Services (Pty) Ltd",
    summary:
      "Finance for suppliers who have been awarded a tender but do not have the funds to deliver. A purchase order is required.",
    minAmount: 5000,
    maxAmount: 250000,
    defaultAmount: 25000,
    minTerm: 1,
    maxTerm: 12,
    defaultTerm: 3,
    productType: "instalment",
    settlement: "As agreed on the supply-and-delivery loan agreement",
    extraRow: ["Required document", "Purchase order (P.O.)"],
    eligibility: [
      "Awarded tender or contract to supply goods or services",
      "Unable to finance delivery from own funds",
      "Valid purchase order (P.O.) for this loan",
      "ID and contact details of the borrower / supplier",
    ],
    documents: [
      { key: "id", label: "National ID or Passport", hint: "Borrower’s ID number as on the supply-and-delivery agreement" },
      { key: "purchase_order", label: "Purchase order (P.O.)", hint: "Required. Official P.O. for the tendered goods or services" },
      { key: "tender_award", label: "Tender award / contract", hint: "Letter or contract showing the tender awarded to you" },
      { key: "proof_of_address", label: "Proof of residential / business address", hint: "Address as it will appear on the loan agreement" },
    ],
    step2Title: "Tender, security & bank details",
    step2Hint: "For loans awarded to suppliers who have tenders but do not have finances to deliver services.",
    requiresEmployment: false,
    requiresIncomeExpenditure: false,
    requiresCreditHistory: false,
    requiresReferral: false,
    requiresBankDetails: true,
    requiresNextPayDate: false,
    requiresEftMandate: false,
    requiresCreditCheckConsent: false,
    requiresCollateral: true,
    amountStep: 500,
  },
];

export function getLoanProduct(id: string | null | undefined): LoanProduct | undefined {
  return LOAN_PRODUCTS.find((p) => p.id === id);
}

export function loanProductLabel(id: string | null | undefined, productType?: string): string {
  const product = getLoanProduct(id);
  if (product) return product.title;
  if (id === "payday_advance") return "Personal loan (no payslip)";
  if (id === "short_term_instalment") return "First-time loan application";
  if (id === "payroll_scheme") return "Tender / purchase order loan";
  return productType === "once_off" ? "Once-off personal loan" : "Loan application";
}
