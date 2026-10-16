import type { RuleFunction } from "../schemas/rule.js";
import type { LoanApplicationInput } from "../schemas/application.js";

import { evaluateR01 } from "../rules/r01-loan-principal.js";
import { evaluateR02 } from "../rules/r02-term-ceiling.js";
import { evaluateR03 } from "../rules/r03-short-term-finance-charge.js";
import { evaluateR04 } from "../rules/r04-long-term-effective-rate.js";
import { evaluateR05 } from "../rules/r05-penalty-cap.js";
import { evaluateR06 } from "../rules/r06-penalty-duration.js";

import { getLoanParameters } from "../parameters/parameter-provider.js";

export const ruleRegistry: Record<
  string,
  RuleFunction<LoanApplicationInput>
> = {
  R01: (input) =>
    evaluateR01(
      {
        loanAmount: input.loanAmount,
      },
      getLoanParameters()
    ),

  R02: (input) =>
    evaluateR02(
      {
        termMonths: input.termMonths,
      },
      getLoanParameters()
    ),

  R03: (input) =>
    evaluateR03(
      {
        loanAmount: input.loanAmount,
        termMonths: input.termMonths,
        totalFinanceCharges: input.totalFinanceCharges,
      },
      getLoanParameters()
    ),

  R04: (input) =>
    evaluateR04(
      {
        termMonths: input.termMonths,
        effectiveRate: input.effectiveRate,
        primeRate: input.primeRate,
      },
      getLoanParameters()
    ),

  R05: (input) =>
    evaluateR05(
      {
        outstandingAmount: input.outstandingAmount,
        defaultCharges: input.defaultCharges,
      },
      getLoanParameters()
    ),

  R06: (input) =>
    evaluateR06(
      {
        daysPastDue: input.daysPastDue,
      },
      getLoanParameters()
    ),
};