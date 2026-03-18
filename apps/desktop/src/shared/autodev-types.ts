export type AutodevModelRole = "planning" | "coding" | "review" | "research";

export type AutodevTriggerSource = "manual" | "scheduled";

export type AutodevRunStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "aborted";

export type AutodevStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "blocked";

export type AutodevStageId =
  | "repository-scan"
  | "project-memory"
  | "knowledge-intake"
  | "tool-routing"
  | "web-research"
  | "implementation-plan"
  | "parallel-coding"
  | "code-review"
  | "qa-validation"
  | "intelligence-report";

export type AutodevConsoleLevel =
  | "system"
  | "phase"
  | "command"
  | "result"
  | "research"
  | "warning"
  | "error";

export type AutodevLiveFileStatus =
  | "indexing"
  | "reading"
  | "writing"
  | "compiling"
  | "reviewing"
  | "testing"
  | "completed";

export interface AutodevScheduleEntry {
  id: string;
  enabled: boolean;
  hour: number;
  minute: number;
  days: string[];
  label: string;
}

export interface AutodevConfig {
  maxParallelAgents: number;
  targetBranch: string;
  workBranchPrefix: string;
  maxLinesChanged: number;
  maxFilesPerRun: number;
  scheduleEntries: AutodevScheduleEntry[];
  models: Record<AutodevModelRole, string>;
  enabledToolSlugs: string[];
  toolAgents: Record<string, { assigned: number; simultaneous: number }>;
}

export interface AutodevRunRequest {
  repoFullName?: string;
  repoBranch?: string;
  repoProvider?: string;
  repoUrl?: string | null;
  localPath?: string | null;
  triggerSource?: AutodevTriggerSource;
  scheduleLabel?: string | null;
}

export interface AutodevStage {
  id: AutodevStageId;
  title: string;
  description: string;
  status: AutodevStageStatus;
  model: string;
  parallelAgents: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AutodevConsoleEntry {
  id: string;
  timestamp: string;
  level: AutodevConsoleLevel;
  title: string;
  content: string;
  command?: string;
}

export interface AutodevLiveFileActivity {
  id: string;
  path: string;
  status: AutodevLiveFileStatus;
  summary: string;
  lineRange: string;
  linesTouched: number;
  agent: string;
  updatedAt: string;
  excerpt: string;
}

export interface AutodevQaCheck {
  id: string;
  label: string;
  result: "passed" | "warning" | "failed";
  details: string;
}

export interface AutodevReportFile {
  path: string;
  lines: number;
  action: string;
}

export interface AutodevRunReport {
  objective: string;
  resultSummary: string;
  filesModified: number;
  linesModified: number;
  filesRead: number;
  selectedTools: string[];
  documentsUsed: string[];
  researchQueries: string[];
  validations: string[];
  warnings: string[];
  files: AutodevReportFile[];
  qaChecks: AutodevQaCheck[];
}

export interface AutodevHistoryEntry {
  id: string;
  status: Exclude<AutodevRunStatus, "idle" | "running">;
  triggerSource: AutodevTriggerSource;
  startedAt: string;
  completedAt: string;
  summary: string;
  filesModified: number;
  linesModified: number;
  objective: string;
}

export interface AutodevRunState {
  running: boolean;
  status: AutodevRunStatus;
  currentRunId: string | null;
  currentStageId: AutodevStageId | null;
  triggerSource: AutodevTriggerSource | null;
  scheduleLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  lastError: string | null;
  stages: AutodevStage[];
  console: AutodevConsoleEntry[];
  liveFiles: AutodevLiveFileActivity[];
  report: AutodevRunReport | null;
}

export interface AutodevRuntimeSnapshot {
  config: AutodevConfig;
  state: AutodevRunState;
  history: AutodevHistoryEntry[];
}

export const AUTODEV_RUNTIME_CHANNEL = "autodev:runtime-updated";

const DEFAULT_ENABLED_TOOL_SLUGS = [
  "autonomous_docs",
  "quality",
  "improvement",
  "qa_correction",
  "security",
  "optimization",
  "spaghetti_cleanup",
  "new_implementation",
];

const STAGE_BLUEPRINTS: Array<{
  id: AutodevStageId;
  title: string;
  description: string;
  role: AutodevModelRole;
  parallelAgents: number;
}> = [
  {
    id: "repository-scan",
    title: "Escaneo del repositorio",
    description: "Indexa estructura, ramas, rutas y zonas criticas del proyecto.",
    role: "planning",
    parallelAgents: 1,
  },
  {
    id: "project-memory",
    title: "Memoria de proyecto",
    description: "Construye contexto persistente del codigo, modulos y patrones.",
    role: "planning",
    parallelAgents: 1,
  },
  {
    id: "knowledge-intake",
    title: "Contexto adicional",
    description: "Incorpora README, PRD y documentos cargados por el usuario.",
    role: "planning",
    parallelAgents: 1,
  },
  {
    id: "tool-routing",
    title: "Orquestacion de herramientas",
    description: "Asigna agentes y activa herramientas segun la configuracion elegida.",
    role: "planning",
    parallelAgents: 1,
  },
  {
    id: "web-research",
    title: "Investigacion web",
    description: "Lanza agentes de busqueda en paralelo con trazabilidad auditable.",
    role: "research",
    parallelAgents: 2,
  },
  {
    id: "implementation-plan",
    title: "Plan de implementacion",
    description: "Genera el plan ejecutable dentro de limites de archivos, lineas y riesgo.",
    role: "planning",
    parallelAgents: 1,
  },
  {
    id: "parallel-coding",
    title: "Generacion paralela",
    description: "Edita archivos, compila y ejecuta cambios dentro del presupuesto definido.",
    role: "coding",
    parallelAgents: 3,
  },
  {
    id: "code-review",
    title: "Revision tecnica",
    description: "Verifica compilacion, tipado, lint, consistencia y codigo huerfano.",
    role: "review",
    parallelAgents: 1,
  },
  {
    id: "qa-validation",
    title: "QA autonomo",
    description: "Ejecuta pruebas y valida que el resultado sea correcto y estable.",
    role: "review",
    parallelAgents: 1,
  },
  {
    id: "intelligence-report",
    title: "Informe de inteligencia",
    description: "Resume objetivos, cambios, pruebas y resultados del run.",
    role: "planning",
    parallelAgents: 1,
  },
];

const MODEL_LABELS: Record<string, string> = {
  "system-local": "Sistema local",
  "gemini-3.1-pro-preview-customtools": "Gemini 3.1 Pro",
  "gemini-3-flash-preview": "Gemini 3 Flash",
  "gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro",
  "gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "mistral-large-latest": "Mistral Large",
  "mistral-medium-latest": "Mistral Medium",
  "codestral-latest": "Codestral",
  "mistral-small-latest": "Mistral Small",
  "gpt-oss-120b": "GPT OSS 120B",
  "ollama/llama3.3:70b": "Llama 3.3 70B",
  "ollama/qwen3:32b": "Qwen 3 32B",
  "ollama/codellama:34b": "Code Llama 34B",
  "lmstudio/local-model": "Modelo local",
};

export function createDefaultAutodevConfig(): AutodevConfig {
  return {
    maxParallelAgents: 3,
    targetBranch: "main",
    workBranchPrefix: "autodev/",
    maxLinesChanged: 1200,
    maxFilesPerRun: 18,
    scheduleEntries: [
      {
        id: "sch_default_1",
        enabled: true,
        hour: 3,
        minute: 0,
        days: ["*"],
        label: "Madrugada",
      },
    ],
    models: {
      planning: "gemini-3.1-pro-preview-customtools",
      coding: "gemini-3.1-pro-preview-customtools",
      review: "gemini-3-flash-preview",
      research: "gemini-3-flash-preview",
    },
    enabledToolSlugs: [...DEFAULT_ENABLED_TOOL_SLUGS],
    toolAgents: {},
  };
}

export function cloneAutodevConfig(config: AutodevConfig): AutodevConfig {
  return {
    ...config,
    scheduleEntries: config.scheduleEntries.map((entry) => ({
      ...entry,
      days: [...entry.days],
    })),
    models: { ...config.models },
    enabledToolSlugs: [...config.enabledToolSlugs],
    toolAgents: Object.fromEntries(
      Object.entries(config.toolAgents).map(([slug, allocation]) => [
        slug,
        { ...allocation },
      ]),
    ),
  };
}

export function getAutodevModelLabel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId;
}

export function formatAutodevTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function createAutodevStages(config: AutodevConfig): AutodevStage[] {
  return STAGE_BLUEPRINTS.map((stage) => ({
    id: stage.id,
    title: stage.title,
    description: stage.description,
    status: "pending",
    model:
      stage.id === "repository-scan" || stage.id === "tool-routing"
        ? "system-local"
        : config.models[stage.role],
    parallelAgents: Math.min(stage.parallelAgents, config.maxParallelAgents),
    startedAt: null,
    completedAt: null,
  }));
}

export function createIdleAutodevState(
  config: AutodevConfig = createDefaultAutodevConfig(),
): AutodevRunState {
  return {
    running: false,
    status: "idle",
    currentRunId: null,
    currentStageId: null,
    triggerSource: null,
    scheduleLabel: null,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
    lastError: null,
    stages: createAutodevStages(config),
    console: [],
    liveFiles: [],
    report: null,
  };
}

export function createAutodevRuntimeSnapshot(): AutodevRuntimeSnapshot {
  const config = createDefaultAutodevConfig();
  return {
    config,
    state: createIdleAutodevState(config),
    history: [],
  };
}

export function normalizeAutodevConfig(
  raw: Record<string, unknown> | null | undefined,
  fallback: AutodevConfig = createDefaultAutodevConfig(),
): AutodevConfig {
  const next = cloneAutodevConfig(fallback);

  if (!raw) {
    return next;
  }

  if (typeof raw.maxParallelAgents === "number") {
    next.maxParallelAgents = Math.max(1, Math.trunc(raw.maxParallelAgents));
  }
  if (typeof raw.targetBranch === "string" && raw.targetBranch.trim()) {
    next.targetBranch = raw.targetBranch.trim();
  }
  if (typeof raw.workBranchPrefix === "string" && raw.workBranchPrefix.trim()) {
    next.workBranchPrefix = raw.workBranchPrefix.trim();
  }
  if (typeof raw.maxLinesChanged === "number") {
    next.maxLinesChanged = Math.max(1, Math.trunc(raw.maxLinesChanged));
  }
  if (typeof raw.maxFilesPerRun === "number") {
    next.maxFilesPerRun = Math.max(1, Math.trunc(raw.maxFilesPerRun));
  }

  if (Array.isArray(raw.scheduleEntries)) {
    next.scheduleEntries = raw.scheduleEntries
      .filter(isScheduleEntryLike)
      .map((entry) => ({
        id: entry.id,
        enabled: entry.enabled,
        hour: Math.min(Math.max(Math.trunc(entry.hour), 0), 23),
        minute: Math.min(Math.max(Math.trunc(entry.minute), 0), 59),
        days: Array.isArray(entry.days) && entry.days.length > 0
          ? entry.days.map(String)
          : ["*"],
        label: typeof entry.label === "string" ? entry.label : "",
      }));
  }

  if (Array.isArray(raw.enabledToolSlugs)) {
    next.enabledToolSlugs = raw.enabledToolSlugs.map(String);
  }

  if (raw.models && typeof raw.models === "object") {
    const models = raw.models as Record<string, unknown>;
    for (const key of Object.keys(next.models) as AutodevModelRole[]) {
      if (typeof models[key] === "string" && models[key].trim()) {
        next.models[key] = models[key].trim();
      }
    }
  }

  if (raw.agents && typeof raw.agents === "object") {
    const agents = raw.agents as Record<string, { model?: string }>;
    if (typeof agents.coder?.model === "string" && agents.coder.model.trim()) {
      next.models.planning = agents.coder.model.trim();
      next.models.coding = agents.coder.model.trim();
    }
    if (
      typeof agents.reviewer?.model === "string" &&
      agents.reviewer.model.trim()
    ) {
      next.models.review = agents.reviewer.model.trim();
    }
    if (
      typeof agents.researcher?.model === "string" &&
      agents.researcher.model.trim()
    ) {
      next.models.research = agents.researcher.model.trim();
    }
  }

  if (raw.toolAgents && typeof raw.toolAgents === "object") {
    next.toolAgents = Object.fromEntries(
      Object.entries(raw.toolAgents as Record<string, Record<string, unknown>>)
        .filter(([, value]) => typeof value === "object" && value !== null)
        .map(([slug, value]) => [
          slug,
          {
            assigned: toPositiveInt(value.assigned, 1),
            simultaneous: toPositiveInt(value.simultaneous, 1),
          },
        ]),
    );
  }

  return next;
}

export function mergeAutodevConfig(
  base: AutodevConfig,
  updates: Record<string, unknown>,
): AutodevConfig {
  return normalizeAutodevConfig(updates, base);
}

export function matchesScheduleEntry(
  entry: AutodevScheduleEntry,
  date: Date,
): boolean {
  if (!entry.enabled) {
    return false;
  }

  const matchesTime =
    entry.hour === date.getHours() && entry.minute === date.getMinutes();
  if (!matchesTime) {
    return false;
  }

  if (entry.days.includes("*")) {
    return true;
  }

  return entry.days.includes(String(date.getDay()));
}

function isScheduleEntryLike(value: unknown): value is {
  id: string;
  enabled: boolean;
  hour: number;
  minute: number;
  days: unknown[];
  label: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { enabled?: unknown }).enabled === "boolean" &&
    typeof (value as { hour?: unknown }).hour === "number" &&
    typeof (value as { minute?: unknown }).minute === "number"
  );
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }

  return fallback;
}
