import { env, type AiProviderName } from "../config/env.js";

export interface AiFile {
  mimeType: string;
  dataBase64: string;
  /** Plain text pulled from a PDF, for providers that cannot read PDFs natively. */
  text?: string;
}

export interface AiRequest {
  system: string;
  prompt: string;
  file: AiFile;
}

export interface AiResponse {
  provider: string;
  model: string;
  raw: string;
}

const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4o",
  ollama: "qwen3:14b",
};

export class AiUnavailableError extends Error {}

export function describeProvider(): string {
  return `${env.aiProvider}/${env.aiModel ?? DEFAULT_MODELS[env.aiProvider as AiProviderName]}`;
}

export async function askModel(req: AiRequest): Promise<AiResponse> {
  switch (env.aiProvider) {
    case "anthropic":
      return askAnthropic(req);
    case "openai":
      return askOpenAi(req);
    case "ollama":
      return askOllama(req);
    default:
      throw new AiUnavailableError(`Unknown AI_PROVIDER "${env.aiProvider}"`);
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new AiUnavailableError(`Could not reach the AI provider: ${(error as Error).message}`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new AiUnavailableError(`AI provider returned ${res.status}: ${detail}`);
  }
  return res.json();
}

const isImage = (mime: string) => mime.startsWith("image/");

async function askAnthropic({ system, prompt, file }: AiRequest): Promise<AiResponse> {
  const apiKey = env.anthropicApiKey;
  if (!apiKey) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  const model = env.aiModel ?? DEFAULT_MODELS.anthropic;
  const block = isImage(file.mimeType)
    ? { type: "image", source: { type: "base64", media_type: file.mimeType, data: file.dataBase64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.dataBase64 } };

  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    { model, max_tokens: 1024, system, messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }] },
  );
  const raw = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  return { provider: "anthropic", model, raw };
}

async function askOpenAi({ system, prompt, file }: AiRequest): Promise<AiResponse> {
  const apiKey = env.openaiApiKey;
  if (!apiKey) throw new AiUnavailableError("OPENAI_API_KEY is not set");
  const model = env.aiModel ?? DEFAULT_MODELS.openai;
  const content: any[] = [];
  if (isImage(file.mimeType)) {
    content.push({ type: "image_url", image_url: { url: `data:${file.mimeType};base64,${file.dataBase64}` } });
  } else {
    content.push({ type: "text", text: `Document text:\n${file.text ?? ""}` });
  }
  content.push({ type: "text", text: prompt });

  const data = await postJson(
    "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${apiKey}` },
    {
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content }],
    },
  );
  return { provider: "openai", model, raw: data.choices?.[0]?.message?.content ?? "" };
}

async function askOllama({ system, prompt, file }: AiRequest): Promise<AiResponse> {
  const image = isImage(file.mimeType);
  const model = image ? env.aiVisionModel : (env.aiModel ?? DEFAULT_MODELS.ollama);
  const userMessage: Record<string, unknown> = image
    ? { role: "user", content: prompt, images: [file.dataBase64] }
    : { role: "user", content: `Document text:\n${file.text ?? ""}\n\n${prompt}` };

  const data = await postJson(`${env.ollamaBaseUrl}/api/chat`, {}, {
    model,
    stream: false,
    format: "json",
    think: false,
    messages: [{ role: "system", content: system }, userMessage],
  });
  return { provider: "ollama", model, raw: data.message?.content ?? "" };
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Plain-text multi-turn chat (no files). Used by the customer chatbot. */
export async function chatModel(system: string, messages: ChatTurn[]): Promise<AiResponse> {
  switch (env.aiProvider) {
    case "anthropic": {
      const apiKey = env.anthropicApiKey;
      if (!apiKey) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
      const model = env.aiModel ?? DEFAULT_MODELS.anthropic;
      const data = await postJson(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 600, system, messages },
      );
      const raw = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      return { provider: "anthropic", model, raw };
    }
    case "openai": {
      const apiKey = env.openaiApiKey;
      if (!apiKey) throw new AiUnavailableError("OPENAI_API_KEY is not set");
      const model = env.aiModel ?? DEFAULT_MODELS.openai;
      const data = await postJson(
        "https://api.openai.com/v1/chat/completions",
        { authorization: `Bearer ${apiKey}` },
        { model, max_tokens: 600, messages: [{ role: "system", content: system }, ...messages] },
      );
      return { provider: "openai", model, raw: data.choices?.[0]?.message?.content ?? "" };
    }
    case "ollama": {
      const model = env.aiModel ?? DEFAULT_MODELS.ollama;
      const data = await postJson(`${env.ollamaBaseUrl}/api/chat`, {}, {
        model,
        stream: false,
        think: false,
        messages: [{ role: "system", content: system }, ...messages],
      });
      return { provider: "ollama", model, raw: data.message?.content ?? "" };
    }
    default:
      throw new AiUnavailableError(`Unknown AI_PROVIDER "${env.aiProvider}"`);
  }
}
