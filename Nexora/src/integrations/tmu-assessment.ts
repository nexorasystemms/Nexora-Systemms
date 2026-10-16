import { evaluateApplication } from "../deterministic/engine/rule-engine.js";
import { getLoanParameters } from "../deterministic/parameters/parameter-provider.js";
import type { AffordabilityResult } from "../deterministic/schemas/affordability-result.js";
import { extractFromFile } from "../documents/extract.js";
import {
  downloadStorageObject,
  insertRow,
  selectRows,
  updateRows,
  type Caller,
} from "./supabase.js";
import { buildEngineInput, type TmuSnapshot } from "./tmu-mapper.js";

export class AssessmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const ENGINE_VERSION = "nexora-deterministic";
// Statuses from which an assessment moves the application to "assessed".
const ASSESSABLE_STATUSES = ["submitted", "under_review"];

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function loadSnapshot(applicationId: string, caller: Caller) {
  const [application] = await selectRows<any>("applications", `id=eq.${applicationId}&select=*`);
  if (!application) throw new AssessmentError("Application not found", 404);

  // Borrowers may only assess their own application; staff only within their tenant.
  const isOwner = caller.role === "borrower" && caller.applicantId === application.applicant_id;
  const isStaff = caller.role !== "borrower" && (caller.isSuperAdmin || caller.tenantId === application.tenant_id);
  if (!isOwner && !isStaff) throw new AssessmentError("Not allowed to assess this application", 403);

  const q = `application_id=eq.${applicationId}`;
  const [applicant, employment, incomeLines, creditHistory, bureauLookups, documents, consents, others] =
    await Promise.all([
      selectRows<any>("applicants", `id=eq.${application.applicant_id}&select=id,marital_status,dependants_count`),
      selectRows<any>("employment", `${q}&select=monthly_net_salary`),
      selectRows<any>("income_expenditure", `${q}&select=line_code,amount`),
      selectRows<any>("credit_history", `${q}&select=monthly_instalment`),
      selectRows<any>("bureau_lookups", `${q}&select=obligations_found`),
      selectRows<any>("documents", `entity_type=eq.application&entity_id=eq.${applicationId}&select=id,doc_type,status,file_path`),
      selectRows<any>("consents", `${q}&select=consent_type,granted,withdrawn_at`),
      selectRows<any>("applications", `applicant_id=eq.${application.applicant_id}&select=id,status`),
    ]);

  if (!applicant[0]) throw new AssessmentError("Applicant record missing", 409);

  return {
    application,
    documents,
    snapshot: <TmuSnapshot>{
      application,
      applicant: applicant[0],
      employment: employment[0] ?? null,
      incomeLines,
      creditHistory,
      bureauLookups,
      documents,
      consents,
      otherApplications: others,
    },
  };
}

/**
 * Reads the payslip's net salary so R12 (income variance) has something to compare against.
 * Re-uses a stored extraction when there is one; otherwise reads the file once and stores the result
 * in `extractions`. Never throws: R12 simply stays dormant when extraction is unavailable.
 */
async function evidencedNetSalary(
  tenantId: string,
  documents: { id: string; doc_type: string; file_path: string }[],
): Promise<number | null> {
  const payslip = documents.find((d) => d.doc_type === "payslip");
  if (!payslip) return null;

  try {
    const [stored] = await selectRows<any>(
      "extractions",
      `document_id=eq.${payslip.id}&select=parsed_json&order=created_at.desc&limit=1`,
    );
    if (stored?.parsed_json?.netSalary != null) return Number(stored.parsed_json.netSalary);

    const ext = payslip.file_path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext];
    if (!mime) return null;

    const bytes = await downloadStorageObject("documents", payslip.file_path);
    const result = await extractFromFile("payslip", mime, bytes);
    await insertRow("extractions", {
      tenant_id: tenantId,
      document_id: payslip.id,
      model: result.model,
      model_version: result.provider,
      prompt_hash: result.promptHash,
      raw_output: result.rawOutput,
      parsed_json: result.fields,
    });
    return typeof result.fields.netSalary === "number" ? result.fields.netSalary : null;
  } catch (error) {
    console.warn("Payslip extraction skipped:", (error as Error).message);
    return null;
  }
}

function ruleSummary(result: AffordabilityResult, status: "PASS" | "FAIL" | "FLAG") {
  return result.rules
    .filter((r) => r.status === status)
    .map((r) => ({
      id: r.ruleId,
      type: r.category,
      detail: r.explanation,
      value: r.value ?? null,
      threshold: r.threshold ?? null,
      overridable: r.overridable,
    }));
}

export async function assessTmuApplication(applicationId: string, caller: Caller) {
  const { application, documents, snapshot } = await loadSnapshot(applicationId, caller);

  snapshot.extractedNetSalary = await evidencedNetSalary(application.tenant_id, documents);

  const input = buildEngineInput(snapshot);
  const result = evaluateApplication(input);
  const v = result.calculatedValues;

  const assessment = await insertRow("assessments", {
    tenant_id: application.tenant_id,
    application_id: applicationId,
    engine_version: `${ENGINE_VERSION}@${result.rulesetVersion}`,
    policy_params_snapshot: getLoanParameters(),
    computed_a: round2(input.incomeA),
    computed_b: round2(input.incomeB),
    computed_c: round2(input.incomeC),
    computed_d: round2(v.totalIncome ?? 0),
    computed_e: round2(input.monthlyExpenditure),
    computed_s: round2(v.disposableIncome ?? 0),
    computed_o: round2(v.existingLoanObligations ?? 0),
    computed_i: round2(v.proposedInstalment ?? 0),
    computed_dsr: Number.isFinite(v.debtServiceRatio) ? Math.round((v.debtServiceRatio ?? 0) * 1e4) / 1e4 : null,
    rules_passed: ruleSummary(result, "PASS"),
    rules_failed: ruleSummary(result, "FAIL"),
    rules_flagged: ruleSummary(result, "FLAG"),
    binding_constraint: result.hardBlocks[0] ?? result.policyFailures[0] ?? null,
    created_by: caller.id,
  });

  let statusChangedTo: string | null = null;
  if (ASSESSABLE_STATUSES.includes(application.status)) {
    await updateRows("applications", `id=eq.${applicationId}`, {
      status: "assessed",
      updated_at: new Date().toISOString(),
    });
    statusChangedTo = "assessed";
  }

  // The engine recommends; a human still records the decision (hard blocks cannot be overridden).
  return { assessmentId: (assessment as any).id as string, statusChangedTo, result };
}
