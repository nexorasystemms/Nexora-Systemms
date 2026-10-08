export const DECLINE_REASONS = [
  { code: "affordability_not_met", label: "Does not meet affordability criteria" },
  { code: "incomplete_documents", label: "Required documents missing or unreadable" },
  { code: "employment_not_verified", label: "Employment could not be verified" },
  { code: "income_not_verified", label: "Income / salary could not be verified" },
  { code: "product_not_eligible", label: "Applicant is not eligible for the selected loan type" },
  { code: "credit_history", label: "Credit history does not meet lending policy" },
  { code: "other", label: "Other (explained in notes)" },
] as const;

export function declineReasonLabel(code: string | null | undefined): string {
  if (!code) return "did not meet lending criteria";
  return DECLINE_REASONS.find((r) => r.code === code)?.label ?? code.replaceAll("_", " ");
}
