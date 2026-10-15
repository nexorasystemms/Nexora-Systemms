import type { RuleResult } from "../schemas/rule-result.js";
import type { LoanApplicationInput } from "../schemas/application.js";
import type { AffordabilityResult } from "../schemas/affordability-result.js";
import { evaluateR11 } from "../rules/r11-evidence-completeness.js";

import { ruleRegistry } from "./rule-registry.js";
import { determineAssessmentStatus } from "./assessment-status.js";
import { calculateAffordability } from "./affordability-engine.js";

import { getLoanParameters } from "../parameters/parameter-provider.js";

import { evaluateR07 } from "../rules/r07-positive-surplus.js";
import { evaluateR08 } from "../rules/r08-instalment-coverage.js";
import { evaluateR09 } from "../rules/r09-debt-service-ratio.js";
import { evaluateR10 } from "../rules/r10-dependant-floor.js";

import { evaluateR12 } from "../rules/r12-income-variance.js"; 
import { evaluateR13 } from "../rules/r13-expenditure-plausibility.js"; 
import { evaluateR14 } from "../rules/r14-maturity-alignment.js"; 
import { evaluateR15 } from "../rules/r15-duplicate-concurrent.js"; import { evaluateR16 } from "../rules/r16-bureau-consent.js";

export function evaluateApplication(
  input: LoanApplicationInput
): AffordabilityResult {
  const parameters = getLoanParameters();

  const results: RuleResult[] = [];

  // ============================================
  // R01-R06
  // ============================================

  for (const rule of Object.values(ruleRegistry)) {
    const result = rule(input);
    results.push(result);
  }

  // ============================================
  // Affordability calculation
  // ============================================

  const affordability = calculateAffordability(
    input,
    parameters
  );

  // ============================================
  // R07 - Positive Surplus
  // ============================================

  results.push(
    evaluateR07({
      disposableIncome:
        affordability.disposableIncome,
    })
  );

  // ============================================
  // R08 - Instalment Coverage
  // ============================================

  results.push(
    evaluateR08({
      proposedInstalment:
        affordability.proposedInstalment,

      coverageLimit:
        affordability.coverageLimit,
    })
  );

  // ============================================
  // R09 - Debt-Service Ratio
  // ============================================

  results.push(
    evaluateR09(
      {
        debtServiceRatio:
          affordability.debtServiceRatio,
      },
      parameters
    )
  );

  // ============================================
  // R10 - Dependant Floor
  // ============================================

  results.push(
    evaluateR10({
      disposableIncome:
        affordability.disposableIncome,

      proposedInstalment:
        affordability.proposedInstalment,

      livingAllowanceFloor:
        affordability.livingAllowanceFloor,
    })
  );
  // ============================================
// R11 - Evidence Completeness
// ============================================

results.push(
  evaluateR11({
    idPresent: input.idPresent,

    payslipPresent: input.payslipPresent,

    employerConfirmationPresent:
      input.employerConfirmationPresent,

    bankStatementPresent:
      input.bankStatementPresent,

    evidenceAccepted:
      input.evidenceAccepted,
  })
);


// ============================================
// R12 - Income Variance
// ============================================

results.push(
  evaluateR12(
    {
      declaredNetSalary:
        input.declaredNetSalary,

      extractedNetSalary:
        input.extractedNetSalary,
    },
    parameters
  )
);

// ============================================
// R13 - Expenditure Plausibility
// ============================================

results.push(
  evaluateR13(
    {
      declaredIncome:
        input.incomeA +
        input.incomeB +
        input.incomeC,

      declaredExpenditure:
        input.monthlyExpenditure,
    },
    parameters
  )
);

// ============================================
// R14 - Maturity Alignment
// ============================================

results.push(
  evaluateR14({
    onceOffPaydayProduct:
      input.onceOffPaydayProduct,

    proposedDueDate:
      input.proposedDueDate,

    declaredNextPayDate:
      input.declaredNextPayDate,
  })
);

// ============================================
// R15 - Duplicate / Concurrent
// ============================================

results.push(
  evaluateR15({
    hasLiveApplicationOrUnsettledLoan:
      input.hasLiveApplicationOrUnsettledLoan,
  })
);

// ============================================
// R16 - Bureau Consent
// ============================================

results.push(
  evaluateR16({
    bureauConsentRecorded:
      input.bureauConsentRecorded,
  })
);

  // ============================================
  // Result classification
  // ============================================

  const hardBlocks = results
    .filter(
      (result) =>
        result.status === "FAIL" &&
        result.category === "REGULATORY"
    )
    .map((result) => result.ruleId);

  const policyFailures = results
    .filter(
      (result) =>
        result.status === "FAIL" &&
        result.category === "POLICY"
    )
    .map((result) => result.ruleId);

  const controlFlags = results
    .filter(
      (result) =>
        result.status === "FLAG"
    )
    .map((result) => result.ruleId);

  const status =
    determineAssessmentStatus(results);

  // ============================================
  // Final result
  // ============================================

  return {
    applicationId: input.applicationId,

    status,

    rules: results,

    hardBlocks,

    policyFailures,

    controlFlags,

    calculatedValues: {
      totalIncome:
        affordability.totalIncome,

      disposableIncome:
        affordability.disposableIncome,

      existingLoanObligations:
        affordability.existingLoanObligations,

      proposedInstalment:
        affordability.proposedInstalment,

      debtServiceRatio:
        affordability.debtServiceRatio,

      coverageLimit:
        affordability.coverageLimit,

      livingAllowanceFloor:
        affordability.livingAllowanceFloor,
    },

    rulesetVersion:
      parameters.version,

    evaluatedAt:
      new Date().toISOString(),
  };
}

