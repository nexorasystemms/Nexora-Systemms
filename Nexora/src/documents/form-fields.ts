import type { DocType } from "./specs.js";

// Keys here are the state names used by the TMU apply form (BorrowerApplyPage.tsx).
export type FormFields = Partial<{
  employerName: string;
  employerAddress: string;
  occupation: string;
  monthlyNetSalary: number;
  grossSalary: number;
  employmentStartDate: string;
  bankName: string;
  accountName: string;
  bankBranch: string;
  accountNumber: string;
  businessName: string;
  tenderReference: string;
}>;

function present<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as Partial<T>;
}

/** Translate what was read from a document into the TMU form's field names. */
export function toFormFields(docType: DocType, d: Record<string, any>): FormFields {
  switch (docType) {
    case "payslip":
      return present({
        employerName: d.employerName,
        employerAddress: d.employerAddress,
        occupation: d.occupation,
        monthlyNetSalary: d.netSalary,
        grossSalary: d.grossSalary,
        employmentStartDate: d.employmentStartDate,
      });
    case "bank_statement":
    case "bank_confirmation":
      return present({
        bankName: d.bankName,
        accountName: d.accountHolder,
        bankBranch: d.branch,
        accountNumber: d.accountNumber,
      });
    case "purchase_order":
      return present({ tenderReference: d.poNumber, businessName: d.supplierName });
    case "tender_award":
      return present({ tenderReference: d.tenderReference, businessName: d.awardedTo });
    default:
      return {};
  }
}

/** Name found on the document, used to warn when it does not match the registered borrower. */
export function holderNameOf(docType: DocType, d: Record<string, any>): string | null {
  switch (docType) {
    case "id":
      return d.fullName ?? null;
    case "payslip":
      return d.employeeName ?? null;
    case "bank_statement":
    case "bank_confirmation":
      return d.accountHolder ?? null;
    case "proof_of_address":
      return d.holderName ?? null;
    default:
      return null;
  }
}
