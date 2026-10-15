
export interface LoanApplicationInput {
  applicationId: string;

  // ============================================
  // Loan request
  // ============================================

  loanAmount: number;
  termMonths: number;

  // ============================================
  // Finance charge assessment
  // ============================================

  totalFinanceCharges: number;
  effectiveRate: number;
  primeRate: number;

  // ============================================
  // Default / penalty assessment
  // ============================================

  outstandingAmount: number;
  defaultCharges: number;
  daysPastDue: number;

  // ============================================
  // Affordability
  // ============================================

  incomeA: number;
  incomeB: number;
  incomeC: number;
  monthlyExpenditure: number;

  // ============================================
  // Existing debt obligations
  // ============================================

  declaredLoanObligations: number;
  bureauLoanObligations: number;

  // ============================================
  // Proposed new loan
  // ============================================

  proposedInstalment: number;

  // ============================================
  // Household
  // ============================================

  dependants: number;

  // ============================================
  // R11 - Evidence
  // ============================================

  idPresent: boolean;
  payslipPresent: boolean;
  employerConfirmationPresent: boolean;
  bankStatementPresent: boolean;
  evidenceAccepted: boolean;

  // ============================================
  // R12 - Income variance
  // ============================================

  declaredNetSalary: number;
  extractedNetSalary: number | undefined;
  // ============================================
  // R13 - Expenditure plausibility
  // ============================================

  // Uses monthlyExpenditure and declared income.
  // No additional fields required.
  
  // ============================================
  // R14 - Maturity alignment
  // ============================================

  onceOffPaydayProduct: boolean;
  proposedDueDate: string | undefined;
  declaredNextPayDate: string | undefined;

  // ============================================
  // R15 - Duplicate / concurrent application
  // ============================================

  hasLiveApplicationOrUnsettledLoan: boolean;

  // ============================================
  // R16 - Bureau consent
  // =======================
  bureauConsentRecorded: boolean;
}

