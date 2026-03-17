/**
 * Model Adapter Port — Interfaz agnóstica de proveedor para llamadas a LLM.
 * El dominio depende de este port; las implementaciones concretas viven en apps/.
 */
import type { ModelRoleKey, ToolDeclaration } from "@auria/contracts";

// ─── Options ───────────────────────────────────────────────────────

export interface ModelCallOptions {
  role: ModelRoleKey;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

// ─── Response Types ────────────────────────────────────────────────

export interface ModelResponse {
  text: string;
  tokensUsed: number;
  modelUsed: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ModelToolResponse {
  text: string | null;
  toolCalls: ToolCall[];
  tokensUsed: number;
  modelUsed: string;
}

// ─── Adapter Interface ─────────────────────────────────────────────

export interface ModelAdapter {
  /**
   * Genera contenido textual dado un prompt.
   */
  generateContent(
    prompt: string,
    options?: ModelCallOptions,
  ): Promise<ModelResponse>;

  /**
   * Genera contenido con posibilidad de llamar herramientas (function calling).
   */
  generateContentWithTools(
    prompt: string,
    tools: ToolDeclaration[],
    options?: ModelCallOptions,
  ): Promise<ModelToolResponse>;

  /**
   * Cuenta tokens de un texto (para routing por tamaño).
   */
  countTokens(text: string): Promise<number>;
}
