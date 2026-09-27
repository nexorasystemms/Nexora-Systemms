import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatNad, Icon } from "./landingUi";

const MAX_RATE = 0.3;

export default function LoanCalculator() {
  const [principal, setPrincipal] = useState(3000);
  const [months, setMonths] = useState(1);

  const quote = useMemo(() => {
    const financeCharge = principal * MAX_RATE;
    const totalPayable = principal + financeCharge;
    const instalment = totalPayable / months;
    return { financeCharge, totalPayable, instalment };
  }, [principal, months]);

  const applyHref = `/portal/register?amount=${principal}&months=${months}`;

  return (
    <div
      id="calculator"
      className="p-6 rounded-2xl bg-surface-container-lowest shadow-xl space-y-4 relative overflow-hidden"
    >
      <div className="flex items-center justify-between pb-1">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-secondary font-bold">
            Interactive Calculator
          </span>
          <h3 className="font-headline text-lg font-semibold text-primary">Repayment Estimator</h3>
        </div>
        <span className="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-mono text-[11px] font-bold">
          NAMFISA AUDITED
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-on-surface-variant font-medium" htmlFor="loanAmount">
            Principal Loan Amount
          </label>
          <span className="font-mono text-lg font-bold text-primary">{formatNad(principal, 0)}</span>
        </div>
        <input
          id="loanAmount"
          className="landing-range w-full h-2 rounded-lg bg-surface-container appearance-none cursor-pointer"
          type="range"
          min={500}
          max={25000}
          step={250}
          value={principal}
          onChange={(event) => setPrincipal(Number(event.target.value))}
        />
        <div className="flex justify-between font-mono text-[11px] text-on-surface-variant">
          <span>N$ 500</span>
          <span>N$ 12,500</span>
          <span>N$ 25,000</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-on-surface-variant font-medium">Repayment Tenure</p>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-container-low">
          {(
            [
              [1, "1 Mo. (Payday)"],
              [3, "3 Months"],
              [6, "6 Months"],
            ] as const
          ).map(([value, label]) => {
            const active = months === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMonths(value)}
                className={`py-2 text-center rounded-lg font-mono text-sm font-semibold transition-all ${
                  active
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface hover:bg-surface-container"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface-container-low space-y-2 text-sm">
        <div className="flex items-center justify-between text-on-surface-variant">
          <span>Net Disbursed Amount</span>
          <span className="font-mono font-medium text-on-surface">{formatNad(principal)}</span>
        </div>
        <div className="flex items-center justify-between text-on-surface-variant">
          <span className="flex items-center gap-1">
            Capped Finance Charge
            <Icon
              name="info"
              className="text-[14px] text-outline"
            />
          </span>
          <span className="font-mono font-medium text-on-surface">
            {formatNad(quote.financeCharge)} (30%)
          </span>
        </div>
        <div className="flex items-center justify-between text-on-surface-variant">
          <span>Estimated Admin &amp; Stamp Duty</span>
          <span className="font-mono font-medium text-on-surface">N$ 0.00</span>
        </div>
        <div className="pt-2 mt-2 bg-surface-container-high/40 -mx-4 px-4 py-2 flex items-center justify-between">
          <div>
            <span className="font-headline text-lg font-bold text-primary block">
              {formatNad(quote.instalment)}
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              {months === 1 ? "Due on Next Payday" : `Monthly for ${months} Months`}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono text-[11px] text-on-surface-variant block uppercase">
              Total Repayable
            </span>
            <span className="font-mono text-sm font-bold text-primary">{formatNad(quote.totalPayable)}</span>
          </div>
        </div>
      </div>

      <Link
        to={applyHref}
        className="w-full py-3.5 rounded-lg bg-secondary hover:bg-on-secondary-fixed text-on-secondary font-headline text-lg font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
      >
        <span>Proceed with These Terms</span>
        <Icon name="chevron_right" className="text-[18px]" />
      </Link>
      <p className="font-mono text-[11px] text-center text-on-surface-variant">
        Zero obligation simulation. Final approval subject to affordability assessment.
      </p>
    </div>
  );
}
