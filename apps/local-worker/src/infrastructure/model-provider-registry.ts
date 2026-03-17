/**
 * Model Provider Registry — Registro centralizado de modelos disponibles.
 * Todos los modelos se consumen a través de Vertex AI Model Garden.
 * Un solo adapter, un solo SDK, unas solas credenciales GCP.
 */
import type { ModelRouterSettings } from "@auria/contracts";
import type { ModelAdapter } from "@auria/domain";
import { GeminiAdapter } from "./gemini-adapter";
import { VertexAdapter } from "./vertex-adapter";

export type ProviderMode = "gemini-direct" | "vertex";

export interface ProviderCredentials {
  /** Gemini API Key (modo directo, sin GCP) */
  geminiApiKey?: string;
  /** GCP Project ID (modo Vertex AI) */
  vertexProjectId?: string;
  /** GCP Region (modo Vertex AI, default: us-central1) */
  vertexLocation?: string;
}

/**
 * Catálogo completo de modelos disponibles via Vertex AI Model Garden.
 */
export const MODEL_CATALOG = [
  // ── Gemini (nativo) ───────────────────────────────────────────────
  { id: "gemini-3.1-pro-preview-customtools", label: "Gemini 3.1 Pro", family: "gemini", tier: "pro" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", family: "gemini", tier: "standard" },
  { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro", family: "gemini", tier: "pro" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash", family: "gemini", tier: "standard" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", family: "gemini", tier: "lite" },

  // ── Claude (Anthropic via Model Garden) ───────────────────────────
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", family: "claude", tier: "pro" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", family: "claude", tier: "standard" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", family: "claude", tier: "lite" },

  // ── Mistral (via Model Garden) ────────────────────────────────────
  { id: "mistral-large-latest", label: "Mistral Large", family: "mistral", tier: "pro" },
  { id: "mistral-medium-latest", label: "Mistral Medium", family: "mistral", tier: "standard" },
  { id: "codestral-latest", label: "Codestral", family: "mistral", tier: "standard" },
  { id: "mistral-small-latest", label: "Mistral Small", family: "mistral", tier: "lite" },

  // ── GPT OSS (via Model Garden) ────────────────────────────────────
  { id: "gpt-oss-120b", label: "GPT OSS 120B", family: "gpt", tier: "pro" },
] as const;

export type ModelId = (typeof MODEL_CATALOG)[number]["id"];

/**
 * Crea el adapter según las credenciales disponibles.
 * Prioriza Vertex AI (soporta todos los modelos).
 * Fallback a Gemini directo si solo hay GEMINI_API_KEY.
 */
export function createModelAdapter(
  credentials: ProviderCredentials,
  routerSettings: ModelRouterSettings,
): { adapter: ModelAdapter; mode: ProviderMode } {
  // Vertex AI: soporta Gemini + Claude + Mistral + GPT via Model Garden
  if (credentials.vertexProjectId) {
    return {
      adapter: new VertexAdapter(
        credentials.vertexProjectId,
        credentials.vertexLocation ?? "us-central1",
        routerSettings,
      ),
      mode: "vertex",
    };
  }

  // Fallback: Gemini API directa (solo modelos Gemini)
  if (credentials.geminiApiKey) {
    return {
      adapter: new GeminiAdapter(credentials.geminiApiKey, routerSettings),
      mode: "gemini-direct",
    };
  }

  throw new Error(
    "[ModelRegistry] No hay credenciales configuradas. " +
    "Configura VERTEX_PROJECT_ID (recomendado) o GEMINI_API_KEY.",
  );
}

/**
 * Filtra el catálogo según el modo de proveedor activo.
 * Vertex: todos los modelos. Gemini directo: solo Gemini.
 */
export function getAvailableModels(mode: ProviderMode) {
  if (mode === "vertex") return MODEL_CATALOG;
  return MODEL_CATALOG.filter((m) => m.family === "gemini");
}
