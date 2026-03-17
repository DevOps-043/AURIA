/**
 * Vertex AI Adapter — Implementación unificada de ModelAdapter.
 * Todos los modelos se consumen a través de Google Cloud Vertex AI:
 *   - Gemini (nativo)
 *   - Claude (Anthropic via Model Garden)
 *   - Mistral (via Model Garden)
 *   - GPT OSS (via Model Garden)
 *
 * Autenticación: Application Default Credentials (ADC) de GCP.
 * No se necesitan API keys de Anthropic, Mistral ni OpenAI.
 */
import type { ModelRouterSettings, ModelRoleKey, ToolDeclaration } from "@auria/contracts";
import type {
  ModelAdapter,
  ModelCallOptions,
  ModelResponse,
  ModelToolResponse,
  ToolCall,
} from "@auria/domain";

const RATE_LIMIT_WAIT_MS = 45_000;
const TOKEN_DOWNGRADE_THRESHOLD = 200_000;
const FALLBACK_MODEL = "gemini-2.0-flash";

type ModelFamily = "gemini" | "claude" | "mistral" | "gpt";

function detectFamily(modelId: string): ModelFamily {
  if (modelId.startsWith("claude-")) return "claude";
  if (modelId.startsWith("mistral-") || modelId.startsWith("codestral")) return "mistral";
  if (modelId.startsWith("gpt-")) return "gpt";
  return "gemini";
}

export class VertexAdapter implements ModelAdapter {
  private vertexAI: any;
  private projectId: string;
  private location: string;
  private routerSettings: ModelRouterSettings;
  private ready: Promise<void>;

  constructor(
    projectId: string,
    location: string,
    routerSettings: ModelRouterSettings,
  ) {
    this.projectId = projectId;
    this.location = location;
    this.routerSettings = routerSettings;
    this.ready = this.initVertex();
  }

  private async initVertex(): Promise<void> {
    const { VertexAI } = await import("@google-cloud/vertexai");
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });
  }

  private getModelForRole(role: ModelRoleKey): { primary: string; fallback: string } {
    const profile = this.routerSettings[role];
    return { primary: profile.primary, fallback: profile.fallback };
  }

  /* ─── Gemini (nativo en Vertex) ───────────────────────────────────── */

  private getGeminiModel(modelName: string, tools?: any[]) {
    const config: any = { model: modelName };
    if (tools && tools.length > 0) {
      config.tools = [{ functionDeclarations: tools }];
    }
    return this.vertexAI.getGenerativeModel(config);
  }

  private async callGemini(
    modelName: string,
    prompt: string,
    tools?: any[],
  ): Promise<{ text: string | null; toolCalls: ToolCall[]; tokensUsed: number }> {
    const model = this.getGeminiModel(modelName, tools);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const response = result.response;
    const candidate = response.candidates?.[0];
    const toolCalls: ToolCall[] = [];
    let text: string | null = null;

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
        }
        if (part.text) {
          text = (text || "") + part.text;
        }
      }
    }

    return {
      text,
      toolCalls,
      tokensUsed: response.usageMetadata?.totalTokenCount ?? Math.ceil(prompt.length / 4),
    };
  }

  /* ─── Claude (Anthropic via Model Garden) ─────────────────────────── */

  private async callClaude(
    modelName: string,
    prompt: string,
    tools?: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<{ text: string | null; toolCalls: ToolCall[]; tokensUsed: number }> {
    const { AnthropicVertex } = await import("@anthropic-ai/vertex-sdk" as any).catch(() => {
      // Fallback: use REST endpoint directly via Vertex AI predict
      return { AnthropicVertex: null };
    });

    if (AnthropicVertex) {
      const client = new AnthropicVertex({
        projectId: this.projectId,
        region: this.location,
      });

      const anthropicTools = tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: "object" as const,
          properties: t.parameters.properties,
          required: t.parameters.required || [],
        },
      }));

      const params: any = {
        model: modelName,
        max_tokens: options?.maxTokens ?? 4096,
        messages: [{ role: "user", content: prompt }],
      };
      if (anthropicTools && anthropicTools.length > 0) {
        params.tools = anthropicTools;
      }

      const response = await client.messages.create(params);

      const toolCalls: ToolCall[] = [];
      let text: string | null = null;

      for (const block of response.content) {
        if (block.type === "text") {
          text = (text || "") + block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({ name: block.name, args: (block.input as Record<string, unknown>) || {} });
        }
      }

      return {
        text,
        toolCalls,
        tokensUsed: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      };
    }

    // Fallback: Vertex AI generative model endpoint for partner models
    const model = this.getGeminiModel(modelName);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      text,
      toolCalls: [],
      tokensUsed: response.usageMetadata?.totalTokenCount ?? Math.ceil(prompt.length / 4),
    };
  }

  /* ─── Mistral / GPT (via Model Garden endpoint) ──────────────────── */

  private async callPartnerModel(
    modelName: string,
    prompt: string,
    tools?: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<{ text: string | null; toolCalls: ToolCall[]; tokensUsed: number }> {
    // Partner models in Vertex AI Model Garden expose a generative model endpoint
    // compatible with the Vertex AI SDK's getGenerativeModel()
    const vertexTools = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: "OBJECT" as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([k, v]) => [
            k,
            {
              type: (v as { type: string; description: string }).type.toUpperCase(),
              description: (v as { type: string; description: string }).description,
            },
          ]),
        ),
        required: t.parameters.required || [],
      },
    }));

    const model = this.getGeminiModel(modelName, vertexTools);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const response = result.response;
    const candidate = response.candidates?.[0];
    const toolCalls: ToolCall[] = [];
    let text: string | null = null;

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
        }
        if (part.text) {
          text = (text || "") + part.text;
        }
      }
    }

    return {
      text,
      toolCalls,
      tokensUsed: response.usageMetadata?.totalTokenCount ?? Math.ceil(prompt.length / 4),
    };
  }

  /* ─── Unified dispatcher ──────────────────────────────────────────── */

  private async dispatch(
    modelName: string,
    prompt: string,
    tools?: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<{ text: string | null; toolCalls: ToolCall[]; tokensUsed: number }> {
    const family = detectFamily(modelName);
    switch (family) {
      case "gemini": {
        const vertexTools = tools?.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: {
            type: "OBJECT" as const,
            properties: Object.fromEntries(
              Object.entries(t.parameters.properties).map(([k, v]) => [
                k,
                {
                  type: (v as { type: string; description: string }).type.toUpperCase(),
                  description: (v as { type: string; description: string }).description,
                },
              ]),
            ),
            required: t.parameters.required || [],
          },
        }));
        return this.callGemini(modelName, prompt, vertexTools);
      }
      case "claude":
        return this.callClaude(modelName, prompt, tools, options);
      case "mistral":
      case "gpt":
        return this.callPartnerModel(modelName, prompt, tools, options);
    }
  }

  /* ─── Public ModelAdapter interface ────────────────────────────────── */

  async generateContent(
    prompt: string,
    options?: ModelCallOptions,
  ): Promise<ModelResponse> {
    await this.ready;
    const role = options?.role ?? "implementation";
    const { primary, fallback } = this.getModelForRole(role);

    let modelName = primary;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if (detectFamily(modelName) === "gemini" && estimatedTokens > TOKEN_DOWNGRADE_THRESHOLD) {
      modelName = FALLBACK_MODEL;
    }

    try {
      const result = await this.dispatch(modelName, prompt, undefined, options);
      return { text: result.text ?? "", tokensUsed: result.tokensUsed, modelUsed: modelName };
    } catch (err: any) {
      if (this.isRateLimitError(err)) {
        await this.sleep(RATE_LIMIT_WAIT_MS);
        const result = await this.dispatch(fallback, prompt, undefined, options);
        return { text: result.text ?? "", tokensUsed: result.tokensUsed, modelUsed: fallback };
      }
      throw err;
    }
  }

  async generateContentWithTools(
    prompt: string,
    tools: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<ModelToolResponse> {
    await this.ready;
    const role = options?.role ?? "research";
    const { primary, fallback } = this.getModelForRole(role);

    let modelName = primary;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if (detectFamily(modelName) === "gemini" && estimatedTokens > TOKEN_DOWNGRADE_THRESHOLD) {
      modelName = FALLBACK_MODEL;
    }

    try {
      const result = await this.dispatch(modelName, prompt, tools, options);
      return { text: result.text, toolCalls: result.toolCalls, tokensUsed: result.tokensUsed, modelUsed: modelName };
    } catch (err: any) {
      if (this.isRateLimitError(err)) {
        await this.sleep(RATE_LIMIT_WAIT_MS);
        const result = await this.dispatch(fallback, prompt, tools, options);
        return { text: result.text, toolCalls: result.toolCalls, tokensUsed: result.tokensUsed, modelUsed: fallback };
      }
      throw err;
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      await this.ready;
      const model = this.getGeminiModel(this.routerSettings.implementation.primary);
      const result = await model.countTokens({
        contents: [{ role: "user", parts: [{ text }] }],
      });
      return result.totalTokens;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }

  /* ─── Helpers ──────────────────────────────────────────────────────── */

  private isRateLimitError(err: any): boolean {
    return (
      err.status === 429 ||
      err.message?.includes("RESOURCE_EXHAUSTED") ||
      err.message?.includes("429")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
