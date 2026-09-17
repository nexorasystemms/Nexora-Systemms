import type { LoanRow, ScheduleRow, RepaymentRow } from "@/types/database";

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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Facility
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5">Repayment Schedule & Status</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Remaining Balance</div>
            <div className="text-base font-extrabold text-slate-900">
              N${balanceRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Disbursement confirmation */}
      <div className="my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-800">Disbursed on:</span>{" "}
          {new Date(loan.disbursed_at).toLocaleDateString()}
        </div>
        <div>
          <span className="font-semibold text-slate-800">Method:</span> {loan.disbursement_method}
        </div>
        <div>
          <span className="font-semibold text-slate-800">Bank Ref:</span>{" "}
          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            {loan.disbursement_reference}
          </span>
        </div>
      </div>

      {/* Instalments Table */}
      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Scheduled Instalments
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Instalment #</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Amount Due</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-medium text-slate-800">
                    Instalment {s.instalment_number}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{s.due_date}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    N${Number(s.amount_due).toFixed(2)}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                        s.status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.status === "due"
                          ? "bg-amber-100 text-amber-800"
                          : s.status === "missed"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="mt-6 p-4 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs text-teal-900">
        <h5 className="font-bold text-teal-950 mb-1">How to Make Your Repayment</h5>
        <p className="mb-2 leading-relaxed">
          Please make Electronic Funds Transfer (EFT) or direct cash deposit to TMU CashLoan CC:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px] bg-white p-3 rounded-lg border border-teal-200">
          <div>
            <strong>Bank:</strong> Bank Windhoek / FNB Namibia
          </div>
          <div>
            <strong>Account Name:</strong> TMU CashLoan CC
          </div>
          <div>
            <strong>Account Type:</strong> Business Cheque
          </div>
          <div>
            <strong>Payment Reference:</strong> Use your ID Number or Agreement Ref
          </div>
        </div>
      </div>
    </div>
  );
}
