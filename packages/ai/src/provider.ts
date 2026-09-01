import { z, type ZodType } from "zod";
import type { AiAction } from "./contracts";

export type AiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
export type AiProviderResponse = { value: unknown; usage?: AiUsage; latencyMs: number };

export type AiProviderRequest = {
  action: AiAction;
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateJson(request: AiProviderRequest): Promise<AiProviderResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI_NOT_CONFIGURED");
    this.name = "AiNotConfiguredError";
  }
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

export class OpenAiResponsesProvider implements AiProvider {
  readonly name = "openai";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly timeoutMs = 30_000
  ) {}

  async generateJson(request: AiProviderRequest): Promise<AiProviderResponse> {
    const started = Date.now();
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
          method: "POST",
          headers: { "authorization": `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            input: [
              { role: "system", content: [{ type: "input_text", text: request.system }] },
              { role: "user", content: [{ type: "input_text", text: request.user }] }
            ],
            text: {
              format: {
                type: "json_schema",
                name: request.schemaName,
                schema: request.jsonSchema,
                strict: true
              }
            }
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        const payload = await response.json() as Record<string, unknown>;
        if (!response.ok) {
          const message = typeof payload.error === "object" && payload.error && typeof (payload.error as { message?: unknown }).message === "string" ? (payload.error as { message: string }).message : `OpenAI request failed with ${response.status}`;
          throw new Error(message);
        }
        const text = outputText(payload);
        if (!text) throw new Error("AI_EMPTY_STRUCTURED_OUTPUT");
        const usageRaw = payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : {};
        return {
          value: JSON.parse(text),
          latencyMs: Date.now() - started,
          usage: {
            inputTokens: typeof usageRaw.input_tokens === "number" ? usageRaw.input_tokens : undefined,
            outputTokens: typeof usageRaw.output_tokens === "number" ? usageRaw.output_tokens : undefined,
            totalTokens: typeof usageRaw.total_tokens === "number" ? usageRaw.total_tokens : undefined
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("AI_PROVIDER_FAILURE");
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw lastError ?? new Error("AI_PROVIDER_FAILURE");
  }
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "deterministic-test";
  constructor(private readonly handler: (request: AiProviderRequest) => unknown | Promise<unknown>) {}
  async generateJson(request: AiProviderRequest): Promise<AiProviderResponse> {
    const started = Date.now();
    return { value: await this.handler(request), latencyMs: Date.now() - started };
  }
}

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  const provider = env.AI_PROVIDER?.trim().toLowerCase();
  if (provider === "openai" || (!provider && env.OPENAI_API_KEY)) {
    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) return null;
    return new OpenAiResponsesProvider(env.OPENAI_MODEL, env.OPENAI_API_KEY, env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  }
  return null;
}

export function jsonSchemaFor(schema: ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>;
  delete generated.$schema;
  return generated;
}

export async function generateValidated<T>(provider: AiProvider | null, input: {
  action: AiAction;
  system: string;
  user: string;
  schemaName: string;
  schema: ZodType<T>;
}): Promise<{ data: T; provider: string; model: string; usage?: AiUsage; latencyMs: number }> {
  if (!provider) throw new AiNotConfiguredError();
  let lastIssues = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await provider.generateJson({
      action: input.action,
      system: attempt === 0 ? input.system : `${input.system}\nThe previous structured result failed application validation. Correct it strictly. Validation issues: ${lastIssues}`,
      user: input.user,
      schemaName: input.schemaName,
      jsonSchema: jsonSchemaFor(input.schema)
    });
    const parsed = input.schema.safeParse(response.value);
    if (parsed.success) return { data: parsed.data, provider: provider.name, model: provider.model, usage: response.usage, latencyMs: response.latencyMs };
    lastIssues = parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  }
  throw new Error(`AI_SCHEMA_VALIDATION_FAILED: ${lastIssues}`);
}
