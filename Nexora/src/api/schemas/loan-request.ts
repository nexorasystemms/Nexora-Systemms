import { z } from "zod";

export const loanRequestSchema = z.object({
  applicationId: z.string().min(1),

  loanAmount: z.number().nonnegative(),
  termMonths: z.number().positive(),

  totalFinanceCharges: z.number().nonnegative(),
  effectiveRate: z.number().nonnegative(),
  primeRate: z.number().nonnegative(),

  outstandingAmount: z.number().nonnegative(),
  defaultCharges: z.number().nonnegative(),
  daysPastDue: z.number().nonnegative(),

  incomeA: z.number().nonnegative(),
  incomeB: z.number().nonnegative(),
  incomeC: z.number().nonnegative(),
  monthlyExpenditure: z.number().nonnegative(),

  declaredLoanObligations: z.number().nonnegative(),
  bureauLoanObligations: z.number().nonnegative(),

  proposedInstalment: z.number().nonnegative(),
  dependants: z.number().int().nonnegative(),

  idPresent: z.boolean(),
  payslipPresent: z.boolean(),
  employerConfirmationPresent: z.boolean(),
  bankStatementPresent: z.boolean(),
  evidenceAccepted: z.boolean(),

  declaredNetSalary: z.number().nonnegative(),
  extractedNetSalary: z.number().nonnegative().nullable(),

  onceOffPaydayProduct: z.boolean(),
  proposedDueDate: z.string().nullable(),
  declaredNextPayDate: z.string().nullable(),

  hasLiveApplicationOrUnsettledLoan: z.boolean(),

  bureauConsentRecorded: z.boolean(),
});

export type LoanRequest = z.infer<typeof loanRequestSchema>;