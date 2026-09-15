// SRS §4.4.1 Computation (Table 14). Pure arithmetic — no rounding surprises: everything is
// computed in whole cents internally would be ideal, but NAD amounts here follow the paper
// form's own precision (2 decimal places) since that is what TMU's staff key in.

import type { AssessmentInput, ComputedFigures, PolicyParams } from "./types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** A = basic + benefits + rental − payslip deductions */
export function computeA(input: AssessmentInput): number {
  const l = input.lines;
  return round2((l.INC_BASIC ?? 0) + (l.INC_BENEFITS ?? 0) + (l.INC_RENTAL ?? 0) - (l.INC_DEDUCT ?? 0));
}

/** B = spouse gross − spouse deductions, required only if married in community of property */
export function computeB(input: AssessmentInput): number {
  if (input.maritalStatus !== "married_in_cop") return 0;
  const l = input.lines;
  return round2((l.INC_SPOUSE_GROSS ?? 0) - (l.INC_SPOUSE_DEDUCT ?? 0));
}

/** C = other net income */
export function computeC(input: AssessmentInput): number {
  return round2(input.lines.INC_OTHER ?? 0);
}

/** E = sum of all 17 expenditure lines */
export function computeE(input: AssessmentInput): number {
  const l = input.lines;
  const sum =
    (l.EXP_HOUSING ?? 0) + (l.EXP_UTILITIES ?? 0) + (l.EXP_VEHICLE_INSTALMENT ?? 0) +
    (l.EXP_VEHICLE_RUNNING ?? 0) + (l.EXP_EDUCATION ?? 0) + (l.EXP_CLOTHING ?? 0) +
    (l.EXP_FOOD ?? 0) + (l.EXP_TELECOM ?? 0) + (l.EXP_SUBSCRIPTIONS ?? 0) +
    (l.EXP_SECURITY ?? 0) + (l.EXP_HOUSEKEEPING ?? 0) + (l.EXP_ASSET_INSURANCE ?? 0) +
    (l.EXP_LIFE_FUNERAL_RETIREMENT ?? 0) + (l.EXP_RETAIL_CREDIT ?? 0) + (l.EXP_OTHER ?? 0);
  return round2(sum);
}

/** O = sum of declared instalments; bureau figures (if captured) replace the declared total
 *  when higher, per Table 14: "taking the higher of the two where they conflict". */
export function computeO(input: AssessmentInput): number {
  const declared = round2(input.creditHistory.reduce((sum, c) => sum + c.monthlyInstalment, 0));
  if (input.bureauObligationsTotal == null) return declared;
  return round2(Math.max(declared, input.bureauObligationsTotal));
}

/** Finance charge + the single proposed instalment / repayment, product-aware.
 *
 * Once-off (payday) product ≤ the short-term threshold: a single repayment on next_pay_date.
 * Finance charge is charged at TMU's product rate, capped by R-03 at finance_charge_cap_short_pct
 * of principal — modelled here at exactly the cap, matching the blueprint's finding that TMU's
 * flagship product prices with zero headroom under the cap (SRS §4.4.3 preamble).
 *
 * Instalment product > the short-term threshold: add-on simple interest over the term at the
 * R-04 ceiling (2x prime, dated), spread evenly. This formula is a v1 assumption — confirm
 * TMU's actual instalment pricing methodology with them before it prices a live instalment loan.
 */
export function computeFinanceChargeAndInstalment(
  input: AssessmentInput,
  params: PolicyParams,
): { financeCharge: number; totalRepayable: number; instalment: number } {
  const principal = input.amountRequested;
  const isShortTerm = input.termMonths <= params.finance_charge_cap_short_term_months;

  if (isShortTerm) {
    const financeCharge = round2(principal * params.finance_charge_cap_short_pct);
    const totalRepayable = round2(principal + financeCharge);
    return { financeCharge, totalRepayable, instalment: totalRepayable };
  }

  const annualRate = params.prime_rate_pct * params.finance_charge_cap_long_prime_multiplier;
  const financeCharge = round2(principal * annualRate * (input.termMonths / 12));
  const totalRepayable = round2(principal + financeCharge);
  const instalment = round2(totalRepayable / input.termMonths);
  return { financeCharge, totalRepayable, instalment };
}

export function computeFigures(input: AssessmentInput, params: PolicyParams): ComputedFigures {
  const A = computeA(input);
  const B = computeB(input);
  const C = computeC(input);
  const D = round2(A + B + C);
  const E = computeE(input);
  const S = round2(D - E);
  const O = computeO(input);
  const { financeCharge, totalRepayable, instalment } = computeFinanceChargeAndInstalment(input, params);
  const I = instalment;
  const DSR = D > 0 ? round2((O + I) / D) : Infinity;

  return { A, B, C, D, E, S, O, I, DSR, financeCharge, totalRepayable };
}
