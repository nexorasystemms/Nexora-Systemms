import { requireBorrower } from "@/lib/current-borrower";
import ApplyForm from "./ApplyForm";

export const metadata = {
  title: "Apply for a Cash Loan — TMU CashLoan CC",
};

export default async function BorrowerApplyPage() {
  const { user, applicant } = await requireBorrower();

  return (
    <div className="max-w-3xl mx-auto py-2">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">
          Apply for a Cash Loan
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Fast, transparent, and regulated under the Microlending Act 7 of 2018 (NAMFISA Reg. 25/11/1138).
        </p>
      </div>

      <ApplyForm applicantName={applicant?.full_name ?? user.full_name} />
    </div>
  );
}
