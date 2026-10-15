import { Router } from "express";
import { evaluateApplication } from "../deterministic/engine/rule-engine.js";
import { loanRequestSchema } from "./schemas/loan-request.js";

const router: ReturnType<typeof Router> = Router();

router.post("/evaluate", (req, res) => {
  const parsed = loanRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid loan application",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const input = {
      ...parsed.data,
      extractedNetSalary:
        parsed.data.extractedNetSalary ?? undefined,
      proposedDueDate:
        parsed.data.proposedDueDate ?? undefined,
      declaredNextPayDate:
        parsed.data.declaredNextPayDate ?? undefined,
    };

    const result = evaluateApplication(input);

    res.json(result);
  } catch (error) {
    console.error("Loan evaluation failed:", error);

    res.status(500).json({
      error: "Loan evaluation failed",
    });
  }
});

export default router;