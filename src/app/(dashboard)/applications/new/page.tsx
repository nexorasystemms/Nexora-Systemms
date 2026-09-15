import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewApplicationForm from "./NewApplicationForm";

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ applicantId?: string }>;
}) {
  const { applicantId } = await searchParams;

  if (!applicantId) {
    const supabase = await createClient();
    const { data: applicants } = await supabase
      .from("applicants")
      .select("id, full_name, mobile")
      .order("created_at", { ascending: false })
      .limit(20);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-brand-navy">New Application</h1>
        <p className="text-sm text-brand-muted">
          Pick an applicant first (or <Link href="/applicants/new" className="text-brand-blue underline">create a new one</Link>).
        </p>
        <div className="bg-brand-surface border border-brand-border rounded-xl divide-y divide-brand-border max-w-xl">
          {applicants?.map((a) => (
            <Link key={a.id} href={`/applications/new?applicantId=${a.id}`} className="flex justify-between px-4 py-3 text-sm hover:bg-gray-50 transition">
              <span className="font-medium">{a.full_name}</span>
              <span className="text-brand-muted">{a.mobile}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase.from("applicants").select("id, full_name").eq("id", applicantId).single();

  if (!applicant) {
    return <p className="text-danger">Applicant not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-brand-navy">New Application</h1>
      <NewApplicationForm applicantId={applicant.id} applicantName={applicant.full_name} />
    </div>
  );
}
