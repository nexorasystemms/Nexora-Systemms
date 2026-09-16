import { createClient } from "@/lib/supabase/server";
import { requireBorrower } from "@/lib/current-borrower";
import type { DisclosureParams } from "@/lib/portal";
import ApplyForm from "./ApplyForm";

export default async function PortalApplyPage() {
  const applicant = await requireBorrower();
  const supabase = await createClient();

  const { data: disclosureParams } = await supabase.rpc("portal_disclosure_params", { p_tenant_id: applicant.tenant_id });

  const { data: draft } = await supabase
    .from("applications")
    .select("*")
    .eq("applicant_id", applicant.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let employmentDone = false;
  let documents: { doc_type: string }[] = [];
  if (draft) {
    const { data: employment } = await supabase.from("employment").select("id").eq("application_id", draft.id).maybeSingle();
    employmentDone = !!employment;

    const { data: docs } = await supabase.from("documents").select("doc_type").eq("entity_type", "application").eq("entity_id", draft.id);
    documents = docs ?? [];
  }

  return (
    <ApplyForm
      disclosureParams={(disclosureParams as DisclosureParams | null) ?? {}}
      draftApplication={draft ?? null}
      employmentDone={employmentDone}
      existingDocTypes={documents.map((d) => d.doc_type)}
    />
  );
}
