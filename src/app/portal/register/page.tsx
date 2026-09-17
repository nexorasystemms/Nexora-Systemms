import BorrowerRegisterForm from "./BorrowerRegisterForm";

export const metadata = {
  title: "Create Borrower Account — TMU CashLoan CC",
};

export default function BorrowerRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <BorrowerRegisterForm />
    </div>
  );
}
