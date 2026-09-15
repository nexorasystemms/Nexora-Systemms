import NewApplicantForm from "./NewApplicantForm";

export default function NewApplicantPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">New Applicant</h1>
        <p className="text-sm text-brand-muted">Page 1 of TMU&apos;s paper application form.</p>
      </div>
      <NewApplicantForm />
    </div>
  );
}
