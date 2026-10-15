import { existsSync } from "node:fs";

// Node 22 can load .env natively; ignore if the file is absent (e.g. production env vars).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export type AiProviderName = "anthropic" | "openai" | "ollama";

export const env = {
  port: Number(process.env.PORT ?? 4000),

  // Browser origins allowed to call this service (the TMU site). Comma-separated, "*" for any.
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  aiProvider: (clean(process.env.AI_PROVIDER)?.toLowerCase() ?? "ollama") as AiProviderName,
  aiModel: clean(process.env.AI_MODEL),
  // Ollama text models (e.g. qwen3) cannot read images, so photos need a vision model.
  aiVisionModel: clean(process.env.AI_VISION_MODEL) ?? "qwen2.5vl:7b",
  ollamaBaseUrl: clean(process.env.OLLAMA_BASE_URL) ?? "http://localhost:11434",
  anthropicApiKey: clean(process.env.ANTHROPIC_API_KEY ?? process.env.ANTROPIC_API_KEY),
  openaiApiKey: clean(process.env.OPENAI_API_KEY),

  supabaseUrl: clean(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, ""),
  supabaseAnonKey: clean(process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY),
  supabaseServiceKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),

  // Callers must present a valid Supabase session unless this is explicitly turned off (local dev only).
  requireAuth: process.env.NEXORA_REQUIRE_AUTH !== "false",

  maxUploadBytes: 8 * 1024 * 1024,
};
