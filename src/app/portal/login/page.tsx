import BorrowerLoginForm from "./BorrowerLoginForm";

export const metadata = {
  title: "Borrower Portal Login — TMU CashLoan CC",
};

export default function BorrowerLoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <BorrowerLoginForm />
    </div>
  );
}
