# Nexora automation service

Express service that automates the TMU cash-loan flow. It has three jobs:

1. **Document autofill** - `POST /api/documents/extract` reads an uploaded ID, payslip, bank statement/confirmation,
   proof of address, purchase order or tender award (PDF/JPG/PNG/WebP) and returns the values to pre-fill on the
   TMU apply form (`formFields` uses the form's own field names).
2. **Automated assessment** - `POST /api/loan/assess-application { applicationId }` loads the stored TMU application
   from Supabase, runs the 16-rule deterministic engine with TMU's pricing, saves an `assessments` row and moves
   the application from `submitted`/`under_review` to `assessed`. It only recommends; a staff member still records
   the decision.
3. **Stateless engine** - `POST /api/loan/evaluate` (unchanged) for callers that supply the full input.

Both TMU endpoints require a valid Supabase session token (`Authorization: Bearer ...`). Borrowers may only
assess their own application; staff only within their tenant.

## Run

```bash
cp .env.example .env   # fill in AI provider + Supabase keys
pnpm install
pnpm dev               # http://localhost:4000
pnpm test
```

In the web app set `VITE_NEXORA_API_URL` (default `http://localhost:4000`).

## AI providers

`AI_PROVIDER=anthropic|openai|ollama`. Anthropic reads PDFs and photos directly. OpenAI/Ollama get the PDF's text
layer; photos need a vision model (`ollama pull qwen2.5vl:7b`, set `AI_VISION_MODEL`). Scanned PDFs without a
text layer must be uploaded as photos unless Anthropic is used.
