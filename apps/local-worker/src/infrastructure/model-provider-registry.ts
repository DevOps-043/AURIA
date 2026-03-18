/**
 * Model Provider Registry — Registro centralizado de modelos disponibles.
 * Solo modelos Gemini via API directa de Google.
 */
import type { ModelRouterSettings } from "@auria/contracts";
import type { ModelAdapter } from "@auria/domain";
import { GeminiAdapter } from "./gemini-adapter";

export type ProviderMode = "gemini-direct";

export interface ProviderCredentials {
  /** Gemini API Key */
  geminiApiKey?: string;
}

/**
 * Catálogo de modelos Gemini disponibles.
 */
export const MODEL_CATALOG = [
  { id: "gemini-3.1-pro-preview-customtools", label: "Gemini 3.1 Pro", family: "gemini", tier: "pro" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", family: "gemini", tier: "standard" },
  { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro", family: "gemini", tier: "pro" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash", family: "gemini", tier: "standard" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", family: "gemini", tier: "lite" },
] as const;

export type ModelId = (typeof MODEL_CATALOG)[number]["id"];

/**
 * Crea el adapter con Gemini API directa.
 */
export function createModelAdapter(
  credentials: ProviderCredentials,
  routerSettings: ModelRouterSettings,
): { adapter: ModelAdapter; mode: ProviderMode } {
  if (credentials.geminiApiKey) {
    return {
      adapter: new GeminiAdapter(credentials.geminiApiKey, routerSettings),
      mode: "gemini-direct",
    };
  }

  throw new Error(
    "[ModelRegistry] No hay credenciales configuradas. " +
    "Configura GEMINI_API_KEY.",
  );
}

/**
 * Retorna el catálogo completo de modelos disponibles.
 */
export function getAvailableModels(_mode: ProviderMode) {
  return MODEL_CATALOG;
}
