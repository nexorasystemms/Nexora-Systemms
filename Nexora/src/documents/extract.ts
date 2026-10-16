import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { askModel, type AiFile, type AiResponse } from "../ai/provider.js";
import { env } from "../config/env.js";
import { holderNameOf, toFormFields, type FormFields } from "./form-fields.js";
import { buildPrompt, parseModelJson, SCHEMAS, SYSTEM_PROMPT, type DocType } from "./specs.js";

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export interface ExtractionResult {
  docType: DocType;
  /** What the document actually contained, in the document's own terms. */
  fields: Record<string, unknown>;
  /** The same data translated to TMU apply-form field names. */
  formFields: FormFields;
  holderName: string | null;
  looksLikeExpectedDocument: boolean;
  provider: string;
  model: string;
  promptHash: string;
  rawOutput: string;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractFromFile(
  docType: DocType,
  mimeType: string,
  bytes: Uint8Array,
): Promise<ExtractionResult> {
  if (!(ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    throw new ExtractionError("Unsupported file type. Upload a PDF, JPG, PNG or WebP.", 415);
  }
  if (bytes.byteLength > env.maxUploadBytes) {
    throw new ExtractionError("File is too large to read (limit 8 MB).", 413);
  }

  const file: AiFile = { mimeType, dataBase64: Buffer.from(bytes).toString("base64") };

  // Anthropic reads PDFs natively; other providers get the PDF's text layer.
  if (mimeType === "application/pdf" && env.aiProvider !== "anthropic") {
    file.text = (await pdfText(bytes)).slice(0, 20_000);
    if (file.text.trim().length < 20) {
      throw new ExtractionError(
        "This PDF looks like a scan with no readable text. Upload a clear photo (JPG/PNG) instead.",
      );
    }
  }

  const prompt = buildPrompt(docType);
  let response: AiResponse;
  try {
    response = await askModel({ system: SYSTEM_PROMPT, prompt, file });
  } catch (error) {
    throw new ExtractionError((error as Error).message, 503);
  }

  let parsedJson: any;
  try {
    parsedJson = parseModelJson(response.raw);
  } catch {
    throw new ExtractionError("Could not understand the document. Please fill the form manually.");
  }

  const fields = SCHEMAS[docType].parse(parsedJson) as Record<string, unknown>;
  return {
    docType,
    fields,
    formFields: toFormFields(docType, fields),
    holderName: holderNameOf(docType, fields),
    looksLikeExpectedDocument: parsedJson.looksLikeExpectedDocument !== false,
    provider: response.provider,
    model: response.model,
    promptHash: createHash("sha256")
      .update(SYSTEM_PROMPT + prompt)
      .digest("hex"),
    rawOutput: response.raw,
  };
}
