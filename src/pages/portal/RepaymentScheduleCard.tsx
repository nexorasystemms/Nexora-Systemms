import type { LoanRow, ScheduleRow, RepaymentRow } from "../../types/database";

export default function RepaymentScheduleCard({
  loan,
  schedules,
  repayments,
}: {
  loan: LoanRow;
  schedules: ScheduleRow[];
  repayments: RepaymentRow[];
}) {
  const totalPaid = repayments.reduce((acc, r) => acc + Number(r.amount_paid), 0);
  const totalDue = schedules.reduce((acc, s) => acc + Number(s.amount_due), 0);
  const balanceRemaining = Math.max(0, totalDue - totalPaid);

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md border-b border-outline-variant/30 gap-space-sm">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Active Facility</span>
          <h3 className="text-lg font-bold text-on-surface mt-0.5">Repayment Schedule &amp; Status</h3>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-on-surface-variant">Remaining Balance</div>
          <div className="text-base font-bold text-on-surface font-mono">
            N${balanceRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="my-space-md p-space-md bg-surface-container-low rounded-xl text-[12px] text-on-surface-variant flex flex-wrap items-center justify-between gap-space-sm">
        <div><span className="font-semibold text-on-surface">Disbursed on:</span> {new Date(loan.disbursed_at).toLocaleDateString()}</div>
        <div><span className="font-semibold text-on-surface">Method:</span> {loan.disbursement_method}</div>
        <div>
          <span className="font-semibold text-on-surface">Bank Ref:</span>{" "}
          <span className="font-mono bg-surface-container-lowest px-1.5 py-0.5 rounded">{loan.disbursement_reference}</span>
        </div>
      </div>

      <div className="mt-space-md">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-space-sm">Scheduled Instalments</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant font-semibold">
              <tr>
                <th className="py-2.5 px-3">Instalment #</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Amount Due</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-low/60">
                  <td className="py-3 px-3 font-medium text-on-surface">Instalment {s.instalment_number}</td>
                  <td className="py-3 px-3 text-on-surface-variant font-mono">{s.due_date}</td>
                  <td className="py-3 px-3 font-semibold text-on-surface font-mono">N${Number(s.amount_due).toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                      s.status === "paid"
                        ? "bg-tertiary-fixed/40 text-tertiary-container"
                        : s.status === "due"
                        ? "bg-secondary-container text-on-secondary-container"
                        : s.status === "missed"
                        ? "bg-error-container text-on-error-container"
                        : "bg-surface-container text-on-surface-variant"
                    }`}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-space-lg p-space-md rounded-xl bg-secondary-container/30 text-[12px] text-on-secondary-container">
        <h5 className="font-bold mb-1">How to Make Your Repayment</h5>
        <p className="mb-space-sm leading-relaxed">Please make Electronic Funds Transfer (EFT) or direct cash deposit to TMU CashLoan CC:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm font-mono text-[11px] bg-surface-container-lowest p-space-sm rounded-lg">
          <div><strong>Bank:</strong> Bank Windhoek / FNB Namibia</div>
          <div><strong>Account Name:</strong> TMU CashLoan CC</div>
          <div><strong>Account Type:</strong> Business Cheque</div>
          <div><strong>Payment Reference:</strong> Use your ID Number or Agreement Ref</div>
        </div>
      </div>
    </div>
  );
}
