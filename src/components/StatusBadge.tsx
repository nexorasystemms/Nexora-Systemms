import type { ApplicationStatus } from "@/types/database";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-blue-100 text-blue-700",
  awaiting_documents: "bg-amber-100 text-amber-800",
  assessed: "bg-purple-100 text-purple-700",
  approved: "bg-emerald-100 text-emerald-700",
  approved_with_changes: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-500",
  agreement_generated: "bg-teal-100 text-teal-700",
  agreement_accepted: "bg-teal-100 text-teal-700",
  disbursed: "bg-indigo-100 text-indigo-700",
  performing: "bg-green-100 text-green-700",
  in_arrears: "bg-red-100 text-red-700",
  settled: "bg-gray-100 text-gray-600",
  handed_over: "bg-red-200 text-red-800",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  awaiting_documents: "Awaiting Documents",
  assessed: "Assessed",
  approved: "Approved",
  approved_with_changes: "Approved (Changes)",
  declined: "Declined",
  withdrawn: "Withdrawn",
  agreement_generated: "Agreement Generated",
  agreement_accepted: "Agreement Accepted",
  disbursed: "Disbursed",
  performing: "Performing",
  in_arrears: "In Arrears",
  settled: "Settled",
  handed_over: "Handed Over",
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
