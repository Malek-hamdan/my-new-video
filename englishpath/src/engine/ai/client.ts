import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getApiKey } from "@/native/secrets";
import { GenerationError, NoApiKeyError } from "./errors";

export { GenerationError, NoApiKeyError };

/** The SDK (~100 kB gzip) is loaded on first use, never at app start-up. */
const sdk = () => Promise.all([import("@anthropic-ai/sdk"), import("@anthropic-ai/sdk/helpers/zod")]);

export type ModelId = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

let cached: { key: string; client: Anthropic } | null = null;

async function client(): Promise<Anthropic> {
  const key = await getApiKey();
  if (!key) throw new NoApiKeyError();
  if (cached?.key === key) return cached.client;
  // The key lives only in Android Keystore-backed secure storage and in memory here.
  const [{ default: AnthropicCtor }] = await sdk();
  const c = new AnthropicCtor({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });
  cached = { key, client: c };
  return c;
}

export function resetClient() {
  cached = null;
}

interface JsonRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  model: ModelId;
  maxTokens?: number;
  /** Prior turns for conversational calls (role-play). */
  history?: { role: "user" | "assistant"; content: string }[];
}

/** 401/403 (bad key, no access) and a missing key are not worth retrying. */
const isFatal = (e: unknown) => e instanceof NoApiKeyError || [401, 403].includes(Number((e as { status?: number })?.status));
const isConnection = (e: unknown) => (e as Error)?.name === "APIConnectionError" || (e as Error)?.name === "APIConnectionTimeoutError";

/**
 * One structured-output call validated with Zod. On a refusal, malformed JSON or
 * schema mismatch it retries exactly once (telling the model what was wrong),
 * then throws GenerationError.
 */
export async function generateJson<S extends z.ZodType>(req: JsonRequest<S>): Promise<z.infer<S>> {
  const c = await client();
  const [, { zodOutputFormat }] = await sdk();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote =
      attempt === 0
        ? ""
        : `\n\nYour previous answer was rejected (${String((lastError as Error)?.message ?? lastError).slice(0, 400)}). Return valid JSON that matches the schema exactly.`;
    try {
      const res = await c.beta.messages.parse({
        model: req.model,
        max_tokens: req.maxTokens ?? 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { format: zodOutputFormat(req.schema), effort: "low" },
        system: req.system,
        messages: [...(req.history ?? []), { role: "user", content: req.prompt + retryNote }],
      });
      if (res.stop_reason === "refusal") {
        lastError = new Error("The model declined this request.");
        continue;
      }
      if (res.stop_reason === "max_tokens") {
        lastError = new Error("The answer was cut off (max_tokens).");
        continue;
      }
      const checked = req.schema.safeParse(res.parsed_output);
      if (checked.success) return checked.data;
      lastError = new Error(checked.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    } catch (e) {
      if (isFatal(e)) throw e;
      lastError = e;
    }
  }
  throw new GenerationError(
    isConnection(lastError)
      ? "No connection to Claude. Check your internet and try again."
      : "Couldn't generate valid content. Please try again.",
    lastError,
  );
}

/** Lightweight key check used by Settings ("Test key"). */
export async function testKey(model: ModelId): Promise<boolean> {
  const c = await client();
  const res = await c.messages.create({
    model,
    max_tokens: 16,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  });
  return res.content.some((b) => b.type === "text");
}
