import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { DOC_TYPES } from "../documents/specs.js";
import { ExtractionError, extractFromFile } from "../documents/extract.js";
import { AssessmentError, assessTmuApplication } from "../integrations/tmu-assessment.js";
import { AiUnavailableError } from "../ai/provider.js";
import { answerCustomer, MAX_CHARS, MAX_TURNS } from "../chat/assistant.js";
import { authenticate, supabaseConfigured, type Caller } from "../integrations/supabase.js";

const router: ReturnType<typeof Router> = Router();

/** Resolves the signed-in Supabase user, or sends the error response and returns null. */
async function requireCaller(req: Request, res: Response): Promise<Caller | null> {
  if (!supabaseConfigured()) {
    if (!env.requireAuth) return { id: "dev", role: "dev", tenantId: null, applicantId: null, isSuperAdmin: true };
    res.status(503).json({ error: "Nexora is not connected to Supabase yet." });
    return null;
  }
  const caller = await authenticate(req.header("authorization")).catch(() => null);
  if (!caller) {
    res.status(401).json({ error: "Sign in to use this service." });
    return null;
  }
  return caller;
}

const extractSchema = z.object({
  docType: z.enum(DOC_TYPES),
  mimeType: z.string(),
  // base64 file content (no data: prefix)
  data: z.string().min(1),
});

// Reads one uploaded document and returns the values to pre-fill on the TMU apply form.
router.post("/documents/extract", async (req, res) => {
  const caller = await requireCaller(req, res);
  if (!caller) return;

  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const bytes = Buffer.from(parsed.data.data, "base64");
    const result = await extractFromFile(parsed.data.docType, parsed.data.mimeType, bytes);
    // The raw model output stays server-side.
    const { rawOutput: _raw, promptHash: _hash, ...safe } = result;
    res.json(safe);
  } catch (error) {
    if (error instanceof ExtractionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Document extraction failed:", error);
    res.status(500).json({ error: "Document extraction failed" });
  }
});

// Runs the deterministic rules against a stored TMU application and records the assessment.
router.post("/loan/assess-application", async (req, res) => {
  const caller = await requireCaller(req, res);
  if (!caller) return;

  const parsed = z.object({ applicationId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "applicationId is required" });
    return;
  }

  try {
    const out = await assessTmuApplication(parsed.data.applicationId, caller);
    res.json({
      assessmentId: out.assessmentId,
      statusChangedTo: out.statusChangedTo,
      status: out.result.status,
      hardBlocks: out.result.hardBlocks,
      policyFailures: out.result.policyFailures,
      controlFlags: out.result.controlFlags,
    });
  } catch (error) {
    if (error instanceof AssessmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("TMU assessment failed:", error);
    res.status(500).json({ error: "Assessment failed" });
  }
});

// Customer chatbot. Borrowers only; staff and admins are refused.
const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_CHARS) }))
    .min(1)
    .max(MAX_TURNS * 2),
});
const chatHits = new Map<string, number[]>();
const CHAT_LIMIT = 20; // messages per user per 10 minutes

router.post("/chat", async (req, res) => {
  const caller = await requireCaller(req, res);
  if (!caller) return;
  if (caller.role !== "borrower" && caller.role !== "dev") {
    res.status(403).json({ error: "The assistant is only available to customers." });
    return;
  }

  const now = Date.now();
  const recent = (chatHits.get(caller.id) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= CHAT_LIMIT) {
    res.status(429).json({ error: "You're sending messages too quickly. Please wait a few minutes." });
    return;
  }
  chatHits.set(caller.id, [...recent, now]);

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  try {
    res.json({ reply: await answerCustomer(caller, parsed.data.messages) });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      console.error("Chat AI unavailable:", error.message);
      res.status(503).json({ error: "The assistant is unavailable right now. Please try again shortly." });
      return;
    }
    console.error("Chat failed:", error);
    res.status(500).json({ error: "The assistant ran into a problem." });
  }
});

export default router;
