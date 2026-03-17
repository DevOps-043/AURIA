/**
 * Gemini Adapter — Implementación concreta de ModelAdapter para Google Gemini.
 * Lee ModelRouterSettings para elegir modelo por rol.
 * Incluye: rate limit retry, token counting, >200K auto-downgrade.
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

export class GeminiAdapter implements ModelAdapter {
  private genAI: any;
  private routerSettings: ModelRouterSettings;

  constructor(apiKey: string, routerSettings: ModelRouterSettings) {
    // Dynamic import to avoid hard dependency at module level
    this.routerSettings = routerSettings;
    this.initGenAI(apiKey);
  }

  private async initGenAI(apiKey: string): Promise<void> {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.genAI = new GoogleGenerativeAI(apiKey);
    } catch {
      throw new Error(
        "[@auria/local-worker] @google/generative-ai not installed. Run: npm install @google/generative-ai",
      );
    }
  }

  private getModelForRole(role: ModelRoleKey): { primary: string; fallback: string } {
    const profile = this.routerSettings[role];
    return { primary: profile.primary, fallback: profile.fallback };
  }

  private getModel(modelName: string, options?: { tools?: any[] }) {
    const config: any = { model: modelName };
    if (options?.tools) {
      config.tools = [{ functionDeclarations: options.tools }];
    }
    return this.genAI.getGenerativeModel(config);
  }

  async generateContent(
    prompt: string,
    options?: ModelCallOptions,
  ): Promise<ModelResponse> {
    const role = options?.role ?? "implementation";
    const { primary, fallback } = this.getModelForRole(role);

    // Token-based auto-downgrade
    let modelName = primary;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if (estimatedTokens > TOKEN_DOWNGRADE_THRESHOLD) {
      modelName = FALLBACK_MODEL;
    }

    try {
      const model = this.getModel(modelName);
      const result = await model.generateContent(prompt);
      const response = result.response;
      return {
        text: response.text(),
        tokensUsed: response.usageMetadata?.totalTokenCount ?? estimatedTokens,
        modelUsed: modelName,
      };
    } catch (err: any) {
      // Rate limit retry with fallback
      if (err.status === 429 || err.message?.includes("429")) {
        await this.sleep(RATE_LIMIT_WAIT_MS);
        try {
          const fallbackModel = this.getModel(fallback);
          const result = await fallbackModel.generateContent(prompt);
          const response = result.response;
          return {
            text: response.text(),
            tokensUsed:
              response.usageMetadata?.totalTokenCount ?? estimatedTokens,
            modelUsed: fallback,
          };
        } catch (retryErr: any) {
          throw new Error(
            `[GeminiAdapter] Both ${modelName} and ${fallback} failed: ${retryErr.message}`,
          );
        }
      }
      throw err;
    }
  }

  async generateContentWithTools(
    prompt: string,
    tools: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<ModelToolResponse> {
    const role = options?.role ?? "research";
    const { primary, fallback } = this.getModelForRole(role);

    const geminiTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: "OBJECT" as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([k, v]) => [
            k,
            { type: (v as { type: string; description: string }).type.toUpperCase(), description: (v as { type: string; description: string }).description },
          ]),
        ),
        required: t.parameters.required || [],
      },
    }));

    let modelName = primary;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if (estimatedTokens > TOKEN_DOWNGRADE_THRESHOLD) {
      modelName = FALLBACK_MODEL;
    }

    try {
      const model = this.getModel(modelName, { tools: geminiTools });
      const result = await model.generateContent(prompt);
      const response = result.response;
      const candidate = response.candidates?.[0];
      const toolCalls: ToolCall[] = [];
      let text: string | null = null;

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            toolCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
          if (part.text) {
            text = (text || "") + part.text;
          }
        }
      }

      return {
        text,
        toolCalls,
        tokensUsed:
          response.usageMetadata?.totalTokenCount ?? estimatedTokens,
        modelUsed: modelName,
      };
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes("429")) {
        await this.sleep(RATE_LIMIT_WAIT_MS);
        const model = this.getModel(fallback, { tools: geminiTools });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return {
          text: response.text() || null,
          toolCalls: [],
          tokensUsed:
            response.usageMetadata?.totalTokenCount ?? estimatedTokens,
          modelUsed: fallback,
        };
      }
      throw err;
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      const model = this.getModel(
        this.routerSettings.implementation.primary,
      );
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
