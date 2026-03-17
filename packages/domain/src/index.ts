// ─── Entities ──────────────────────────────────────────────────────
export * from "./entities/demo-workspace.ts";

// ─── Services (existing) ──────────────────────────────────────────
export * from "./services/policy-guards.ts";
export * from "./services/workspace-summary.ts";
export * from "./services/worker-plan.ts";
export * from "./services/aqelor-feasibility.ts";
export * from "./services/billing-commerce.ts";

// ─── Services (AutoDev migration) ─────────────────────────────────
export * from "./services/safety-guards.ts";
export * from "./services/strategy-selector.ts";
export * from "./services/pipeline-planner.ts";
export * from "./services/self-learning.ts";

// ─── Prompts ──────────────────────────────────────────────────────
export * from "./prompts/index.ts";

// ─── Ports ────────────────────────────────────────────────────────
export type {
  ModelAdapter,
  ModelCallOptions,
  ModelResponse,
  ModelToolResponse,
  ToolCall,
} from "./ports/model-adapter.ts";

// ─── Utils ────────────────────────────────────────────────────────
export { runParallel } from "./utils/concurrency.ts";
