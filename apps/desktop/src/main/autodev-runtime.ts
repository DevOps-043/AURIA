import { app } from "electron";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { WorkerRun } from "@auria/contracts";
import {
  REVIEW_PROMPT,
  SUMMARY_PROMPT,
  findPhantomImports,
  hasMajorVersionBump,
  isCodeComplete,
  parseBuildErrors,
} from "@auria/domain";
import type {
  AutodevConfig,
  AutodevConsoleEntry,
  AutodevHistoryEntry,
  AutodevLiveFileActivity,
  AutodevQaCheck,
  AutodevRunRequest,
  AutodevRunReport,
  AutodevRuntimeSnapshot,
  AutodevStageId,
} from "../shared/autodev-types";
import {
  cloneAutodevConfig,
  createAutodevRuntimeSnapshot,
  createAutodevStages,
  formatAutodevTime,
  getAutodevModelLabel,
  matchesScheduleEntry,
  mergeAutodevConfig,
} from "../shared/autodev-types";

type RuntimeListener = (snapshot: AutodevRuntimeSnapshot) => void;
type SecretResolver = (key: string) => string | null;

const execFileAsync = promisify(execFile);

const DATA_DIR = join(app.getPath("userData"), "autodev-runtime");
const CONFIG_PATH = join(DATA_DIR, "config.json");
const HISTORY_PATH = join(DATA_DIR, "history.json");
const MEMORY_DIR = join(DATA_DIR, "memory");
const TEMP_DIFF_DIR = join(app.getPath("temp"), "auria-autodev-diff");

const IGNORE_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "dist",
  "dist-electron",
  "coverage",
  ".next",
  ".turbo",
  ".idea",
  ".vscode",
  "build",
  "out",
  "tmp",
  "temp",
]);

const TEXT_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".toml",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".sql",
  ".sh",
  ".ps1",
]);

const TOOL_LABELS: Record<string, string> = {
  knowledge_intake: "Carga de conocimiento",
  autonomous_docs: "Documentacion",
  research: "Investigacion",
  quality: "Calidad",
  improvement: "Mejora tecnica",
  qa_correction: "Correccion QA",
  security: "Seguridad",
  optimization: "Optimizacion",
  spaghetti_cleanup: "Limpieza profunda",
  new_implementation: "Nueva implementacion",
};

const MAX_CONTEXT_CHARS = 220_000;
const MAX_CONTEXT_FILES = 42;
const MAX_DOC_CHARS = 12_000;
const MAX_RESEARCH_QUERIES = 5;
const MAX_REPORT_HISTORY = 24;

interface RepoFileDescriptor {
  path: string;
  fullPath: string;
  ext: string;
  size: number;
  updatedAt: string;
  priority: number;
}

interface RepoContextFile extends RepoFileDescriptor {
  content: string;
}

interface RepositoryScanResult {
  repoPath: string;
  fileCount: number;
  directoryCount: number;
  files: RepoFileDescriptor[];
  contextFiles: RepoContextFile[];
  existingFiles: Set<string>;
  packageJson: Record<string, unknown> | null;
  packageManager: "npm" | "pnpm" | "yarn";
}

interface MemoryDocument {
  path: string;
  excerpt: string;
  updatedAt: string;
}

interface RepoMemory {
  repoKey: string;
  repoLabel: string;
  firstSeenAt: string;
  lastScannedAt: string | null;
  lastRunAt: string | null;
  indexedFiles: Array<{ path: string; size: number; updatedAt: string }>;
  documents: MemoryDocument[];
  lessons: string[];
  recentRuns: Array<{
    id: string;
    status: string;
    completedAt: string;
    summary: string;
  }>;
}

interface RuntimeResearchQuery {
  query: string;
  urls: string[];
  summary: string;
  excerpt: string;
}

interface RuntimeResearchFinding {
  query: string;
  category: string;
  findings: string;
  actionable: boolean;
  sources: string[];
}

interface PlanStep {
  file: string;
  action: "modify" | "create";
  category: string;
  description: string;
  details: string;
  estimatedLines: number;
  source?: string;
}

interface AggregatedPlanStep {
  file: string;
  action: "modify" | "create";
  category: string;
  description: string;
  details: string;
  estimatedLines: number;
  sources: string[];
}

interface ModifiedFileChange {
  path: string;
  fullPath: string;
  action: "modify" | "create";
  category: string;
  description: string;
  before: string;
  after: string;
  linesChanged: number;
  diff: string;
}

interface RuntimeReviewResult {
  decision: "approve" | "reject";
  summary: string;
  issues: Array<{
    severity: "critical" | "warning" | "info";
    file: string;
    description: string;
    suggestion: string;
  }>;
}

interface RuntimeExecution {
  runId: string;
  startedAtMs: number;
  context: AutodevRunRequest;
  repoLabel: string;
  objective: string;
  repoPath: string;
  scan: RepositoryScanResult | null;
  memory: RepoMemory | null;
  documents: Array<{ path: string; content: string; excerpt: string }>;
  researchQueries: string[];
  researchData: RuntimeResearchQuery[];
  researchFindings: RuntimeResearchFinding[];
  plan: PlanStep[];
  review: RuntimeReviewResult | null;
  modifiedFiles: Map<string, ModifiedFileChange>;
  qaChecks: AutodevQaCheck[];
  validations: string[];
  warnings: string[];
  filesRead: number;
  linesChanged: number;
}

class AutodevAbortError extends Error {
  constructor() {
    super("Ejecucion abortada por el usuario.");
  }
}

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildObjective(toolSlugs: string[]): string {
  if (toolSlugs.length === 0) {
    return "Ejecucion autonoma general del repositorio";
  }

  return toolSlugs
    .map((slug) => TOOL_LABELS[slug] ?? slug)
    .join(" + ");
}

function repoKeyForContext(context: AutodevRunRequest): string {
  const base =
    context.localPath ||
    context.repoFullName ||
    context.repoUrl ||
    "default-repository";
  return createHash("sha1").update(base).digest("hex").slice(0, 20);
}

function truncate(value: string, max = 900): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}...`;
}

function safeParseJson<T = Record<string, unknown>>(value: string): T | null {
  const codeBlockMatch =
    value.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    value.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

  const candidate = codeBlockMatch?.[1] ?? value;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function countDistinctDirectories(files: RepoFileDescriptor[]): number {
  return new Set(files.map((file) => dirname(file.path))).size;
}

function isTextFile(filePath: string): boolean {
  const fileExt = extname(filePath).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(fileExt);
}

function computePriority(relPath: string): number {
  const normalized = normalizePath(relPath).toLowerCase();

  if (
    normalized === "package.json" ||
    normalized.startsWith("package-lock.") ||
    normalized.startsWith("pnpm-lock.") ||
    normalized.startsWith("yarn.lock") ||
    normalized.startsWith("tsconfig") ||
    normalized.startsWith("vite.config") ||
    normalized.startsWith("electron.vite.config")
  ) {
    return 0;
  }

  if (
    normalized === "readme.md" ||
    normalized.startsWith("docs/") ||
    normalized.includes("/readme.md") ||
    normalized.endsWith("/index.ts") ||
    normalized.endsWith("/index.tsx") ||
    normalized.endsWith("/main.ts") ||
    normalized.endsWith("/main.tsx") ||
    normalized.endsWith("/app.tsx") ||
    normalized.endsWith("/app.ts") ||
    normalized.endsWith("/routes.ts") ||
    normalized.endsWith("/router.ts")
  ) {
    return 1;
  }

  if (
    normalized.startsWith("src/") ||
    normalized.startsWith("apps/") ||
    normalized.startsWith("packages/")
  ) {
    return 2;
  }

  return 3;
}

function guessRepoMode(context: AutodevRunRequest): "local" | "remote" {
  return context.localPath ? "local" : "remote";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchUrls(html: string): string[] {
  const urls = new Set<string>();
  const hrefPattern = /href="([^"]+)"/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const rawHref = match[1];
    if (!rawHref) {
      continue;
    }

    let url = rawHref;

    if (url.startsWith("//")) {
      url = `https:${url}`;
    }

    if (url.includes("uddg=")) {
      try {
        const parsed = new URL(url, "https://duckduckgo.com");
        const decoded = parsed.searchParams.get("uddg");
        if (decoded) {
          url = decodeURIComponent(decoded);
        }
      } catch {
        // Ignore malformed URL and fall through.
      }
    }

    if (/^https?:\/\//i.test(url)) {
      urls.add(url);
    }

    if (urls.size >= 5) {
      break;
    }
  }

  return [...urls];
}

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildContextBundle(
  execution: RuntimeExecution,
  limitChars = MAX_CONTEXT_CHARS,
): string {
  if (!execution.scan) {
    return "";
  }

  let consumed = 0;
  const blocks: string[] = [];

  for (const file of execution.scan.contextFiles) {
    if (consumed >= limitChars) {
      break;
    }

    const block = `// === ${file.path} ===\n${file.content}`;
    const remaining = limitChars - consumed;
    const nextBlock =
      block.length > remaining ? `${block.slice(0, remaining)}\n// ...` : block;
    blocks.push(nextBlock);
    consumed += nextBlock.length;
  }

  return blocks.join("\n\n");
}

function buildDocumentsBundle(
  documents: Array<{ path: string; content: string; excerpt: string }>,
): string {
  if (documents.length === 0) {
    return "Sin documentacion adicional cargada.";
  }

  return documents
    .map((document) => `## ${document.path}\n${document.content}`)
    .join("\n\n");
}

function buildResearchSummary(findings: RuntimeResearchFinding[]): string {
  if (findings.length === 0) {
    return "Sin hallazgos externos registrados.";
  }

  return findings
    .map(
      (finding) =>
        `- [${finding.category}] ${finding.query}\n  Hallazgo: ${finding.findings}\n  Fuentes: ${finding.sources.join(", ") || "n/d"}`,
    )
    .join("\n");
}

function buildMemorySummary(memory: RepoMemory | null): string {
  if (!memory) {
    return "Sin memoria persistente previa para este repositorio.";
  }

  const recentRuns = memory.recentRuns
    .slice(0, 5)
    .map(
      (run) =>
        `- ${run.completedAt.slice(0, 10)} [${run.status}] ${truncate(run.summary, 120)}`,
    )
    .join("\n");
  const lessons = memory.lessons.slice(0, 8).map((lesson) => `- ${lesson}`).join("\n");

  return [
    `Archivos indexados historicamente: ${memory.indexedFiles.length}`,
    `Documentos recordados: ${memory.documents.length}`,
    recentRuns ? `Runs recientes:\n${recentRuns}` : "Sin runs recientes.",
    lessons ? `Lecciones persistidas:\n${lessons}` : "Sin lecciones persistidas.",
  ].join("\n\n");
}

function sanitizePlanSteps(rawValue: unknown, maxFiles: number): PlanStep[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const unique = new Map<string, PlanStep>();

  for (const entry of rawValue) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const file = typeof record.file === "string" ? normalizePath(record.file.trim()) : "";
    const action = record.action === "create" ? "create" : "modify";
    const description =
      typeof record.description === "string" ? record.description.trim() : "";
    const details = typeof record.details === "string" ? record.details.trim() : "";

    if (!file || !description) {
      continue;
    }

    if (
      file.startsWith("/") ||
      file.includes("..") ||
      file.includes("node_modules") ||
      file.includes(".git/")
    ) {
      continue;
    }

    unique.set(file, {
      file,
      action,
      category:
        typeof record.category === "string" && record.category.trim()
          ? record.category.trim()
          : "quality",
      description,
      details,
      estimatedLines:
        typeof record.estimatedLines === "number" && Number.isFinite(record.estimatedLines)
          ? Math.max(1, Math.trunc(record.estimatedLines))
          : 80,
      source: typeof record.source === "string" ? record.source.trim() : undefined,
    });

    if (unique.size >= maxFiles) {
      break;
    }
  }

  return [...unique.values()];
}

function aggregatePlanSteps(plan: PlanStep[]): AggregatedPlanStep[] {
  const grouped = new Map<string, AggregatedPlanStep>();

  for (const step of plan) {
    const existing = grouped.get(step.file);
    if (existing) {
      existing.description = `${existing.description}; ${step.description}`;
      existing.details = `${existing.details}\n\n${step.details}`.trim();
      existing.estimatedLines += step.estimatedLines;
      if (step.source) {
        existing.sources.push(step.source);
      }
      if (step.action === "create") {
        existing.action = "create";
      }
    } else {
      grouped.set(step.file, {
        file: step.file,
        action: step.action,
        category: step.category,
        description: step.description,
        details: step.details,
        estimatedLines: step.estimatedLines,
        sources: step.source ? [step.source] : [],
      });
    }
  }

  return [...grouped.values()];
}

function derivePromptCategories(toolSlugs: string[]): string[] {
  const categories = new Set<string>();

  for (const tool of toolSlugs) {
    switch (tool) {
      case "security":
        categories.add("security");
        break;
      case "optimization":
        categories.add("performance");
        break;
      case "autonomous_docs":
        categories.add("documentation");
        break;
      case "qa_correction":
        categories.add("tests");
        categories.add("quality");
        break;
      case "new_implementation":
        categories.add("features");
        break;
      default:
        categories.add("quality");
        break;
    }
  }

  if (categories.size === 0) {
    categories.add("features");
    categories.add("quality");
  }

  return [...categories];
}

function deriveEffectiveParallelism(config: AutodevConfig): number {
  const toolMax = Object.values(config.toolAgents).reduce((max, current) => {
    return Math.max(max, current.simultaneous || 0);
  }, 0);

  return Math.max(1, Math.min(config.maxParallelAgents, toolMax || config.maxParallelAgents));
}

function buildFallbackSummary(
  execution: RuntimeExecution,
  status: "completed" | "failed" | "aborted",
  message?: string,
): string {
  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - execution.startedAtMs) / 60_000),
  );

  const header =
    status === "completed"
      ? "El flujo autonomo termino correctamente."
      : status === "aborted"
        ? "El flujo autonomo fue detenido antes de terminar."
        : "El flujo autonomo termino con errores.";

  const files = execution.modifiedFiles.size;
  const lines = execution.linesChanged;
  const validations = execution.qaChecks
    .map((check) => `${check.label}: ${check.result}`)
    .join(", ");

  return [
    header,
    `Objetivo: ${execution.objective}.`,
    `Archivos modificados: ${files}. Lineas modificadas: ${lines}.`,
    `Duracion aproximada: ${durationMinutes} min.`,
    validations ? `QA: ${validations}.` : "",
    message ? `Detalle: ${message}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function runWithConcurrency<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  maxConcurrency: number,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...tasks];

  const runNext = async (): Promise<void> => {
    const task = queue.shift();
    if (!task) {
      return;
    }
    const result = await task.fn();
    results.set(task.name, result);
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => runNext(),
  );

  await Promise.all(workers);
  return results;
}

type ModelFamily = "gemini" | "local";

function detectModelFamily(modelId: string): ModelFamily {
  const id = modelId.trim().toLowerCase();
  if (id.startsWith("ollama/") || id.startsWith("lmstudio/")) return "local";
  return "gemini";
}

export class AutodevRuntimeManager {
  private snapshot = createAutodevRuntimeSnapshot();
  private history: AutodevHistoryEntry[] = [];
  private scheduleInterval: ReturnType<typeof setInterval> | null = null;
  private lastScheduleTickKey: string | null = null;
  private lastContext: AutodevRunRequest = {};
  private abortController: AbortController | null = null;
  private secretResolver: SecretResolver | null = null;
  private geminiApiKey: string | null = null;
  private geminiClient: any = null;

  constructor(private readonly listener: RuntimeListener) {
    ensureDirectory(DATA_DIR);
    ensureDirectory(MEMORY_DIR);
    ensureDirectory(TEMP_DIFF_DIR);

    const persistedConfig = this.loadConfig();
    this.history = this.loadHistory();
    this.snapshot.config = persistedConfig;
    this.snapshot.state = {
      ...this.snapshot.state,
      stages: createAutodevStages(persistedConfig),
    };

    this.ensureScheduler();
    this.emit();
  }

  setSecretResolver(resolver: SecretResolver): void {
    this.secretResolver = resolver;
  }

  dispose(): void {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    this.abortController?.abort();
  }

  getSnapshot(): AutodevRuntimeSnapshot {
    return {
      config: cloneAutodevConfig(this.snapshot.config),
      state: cloneState(this.snapshot.state),
      history: this.history.map((entry) => ({ ...entry })),
    };
  }

  setContext(context: AutodevRunRequest): void {
    this.lastContext = {
      ...this.lastContext,
      ...context,
    };
  }

  updateConfig(updates: Record<string, unknown>): AutodevRuntimeSnapshot {
    this.snapshot.config = mergeAutodevConfig(this.snapshot.config, updates);
    this.saveConfig();

    if (!this.snapshot.state.running) {
      this.snapshot.state = {
        ...this.snapshot.state,
        stages: createAutodevStages(this.snapshot.config),
      };
    }

    this.emit();
    return this.getSnapshot();
  }

  getStatus(): {
    running: boolean;
    currentPhase: string | null;
    currentRunId: string | null;
  } {
    return {
      running: this.snapshot.state.running,
      currentPhase: this.snapshot.state.currentStageId,
      currentRunId: this.snapshot.state.currentRunId,
    };
  }

  getLegacyHistory(): WorkerRun[] {
    return this.history.map((entry) => ({
      id: entry.id,
      workspaceId: "desktop-autodev",
      mode: "full",
      status:
        entry.status === "aborted"
          ? "aborted"
          : entry.status === "completed"
            ? "completed"
            : "failed",
      improvementsCount: entry.filesModified,
      summary: entry.summary,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    }));
  }

  async startRun(
    request?: Record<string, unknown>,
  ): Promise<{ success: boolean; runId?: string; error?: string }> {
    if (this.snapshot.state.running) {
      return {
        success: false,
        error: "Ya existe una ejecucion autonoma en curso.",
      };
    }

    const nextContext = {
      ...this.lastContext,
      ...(request as AutodevRunRequest | undefined),
    };
    this.lastContext = nextContext;

    const runId = `autodev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = nowIso();

    this.abortController = new AbortController();
    this.snapshot.state = {
      running: true,
      status: "running",
      currentRunId: runId,
      currentStageId: null,
      triggerSource: nextContext.triggerSource ?? "manual",
      scheduleLabel: nextContext.scheduleLabel ?? null,
      startedAt,
      completedAt: null,
      updatedAt: startedAt,
      lastError: null,
      stages: createAutodevStages(this.snapshot.config),
      console: [],
      liveFiles: [],
      report: null,
    };

    this.appendConsole(
      "system",
      "Run iniciado",
      buildStartMessage(nextContext, this.snapshot.config),
    );
    this.emit();

    void this.executeRun(runId, nextContext);

    return { success: true, runId };
  }

  async abortRun(): Promise<{ success: boolean }> {
    if (!this.snapshot.state.running) {
      return { success: true };
    }

    this.appendConsole(
      "warning",
      "Abortando run",
      "Se solicito detener la ejecucion autonoma actual.",
    );
    this.abortController?.abort();
    this.emit();
    return { success: true };
  }

  private async executeRun(
    runId: string,
    context: AutodevRunRequest,
  ): Promise<void> {
    const objective = buildObjective(this.snapshot.config.enabledToolSlugs);
    const execution: RuntimeExecution = {
      runId,
      startedAtMs: Date.now(),
      context,
      repoLabel:
        context.repoFullName ||
        context.localPath ||
        context.repoUrl ||
        "Repositorio sin identificar",
      objective,
      repoPath: context.localPath ? resolve(context.localPath) : "",
      scan: null,
      memory: null,
      documents: [],
      researchQueries: [],
      researchData: [],
      researchFindings: [],
      plan: [],
      review: null,
      modifiedFiles: new Map<string, ModifiedFileChange>(),
      qaChecks: [],
      validations: [],
      warnings: [],
      filesRead: 0,
      linesChanged: 0,
    };

    try {
      await this.runStage(execution, "repository-scan", async () => {
        const scan = await this.scanRepository(context);
        execution.scan = scan;
        execution.repoPath = scan.repoPath;
        execution.filesRead = scan.fileCount;

        this.appendConsole(
          "result",
          "Escaneo completado",
          `Se indexaron ${scan.fileCount} archivos y ${scan.directoryCount} directorios en ${scan.repoPath}.`,
        );
      });

      await this.runStage(execution, "project-memory", async () => {
        const repoKey = repoKeyForContext(context);
        execution.memory = this.loadRepoMemory(repoKey, execution.repoLabel);
        const memorySummary = await this.summarizeProjectMemory(execution);

        if (execution.memory) {
          execution.memory.lessons = [
            truncate(memorySummary, 220),
            ...execution.memory.lessons,
          ].slice(0, 20);
        }

        this.appendConsole(
          "result",
          "Memoria preparada",
          memorySummary,
        );
      });

      await this.runStage(execution, "knowledge-intake", async () => {
        execution.documents = await this.loadKnowledgeDocuments(execution);
        execution.filesRead += execution.documents.length;
        const knowledgeSummary = await this.summarizeKnowledgeIntake(execution);

        this.appendConsole(
          "result",
          "Documentacion integrada",
          knowledgeSummary,
        );
      });

      await this.runStage(execution, "tool-routing", async () => {
        const parallelism = deriveEffectiveParallelism(this.snapshot.config);
        const tools = this.snapshot.config.enabledToolSlugs.map(
          (tool) => TOOL_LABELS[tool] ?? tool,
        );

        this.appendConsole(
          "result",
          "Herramientas y agentes resueltos",
          `Herramientas activas: ${tools.join(", ") || "ninguna"}. Paralelismo efectivo: ${parallelism}.`,
        );
      });

      await this.runStage(execution, "web-research", async () => {
        execution.researchQueries = await this.generateResearchQueries(execution);

        const tasks = execution.researchQueries.map((query, index) => ({
          name: query,
          fn: async () =>
            this.searchWeb(query, `Research ${index + 1}`, this.abortController?.signal),
        }));

        const results =
          tasks.length > 0
            ? await runWithConcurrency(
                tasks,
                Math.min(
                  deriveEffectiveParallelism(this.snapshot.config),
                  Math.max(1, this.snapshot.config.toolAgents.research?.simultaneous || 2),
                ),
              )
            : new Map<string, RuntimeResearchQuery>();

        execution.researchData = [...results.values()];
        execution.researchFindings = await this.summarizeResearch(execution);

        this.appendConsole(
          "research",
          "Investigacion completada",
          execution.researchFindings.length > 0
            ? execution.researchFindings
                .map((finding) => `${finding.category}: ${truncate(finding.findings, 160)}`)
                .join(" | ")
            : "Sin hallazgos accionables externos.",
        );
      });

      await this.runStage(execution, "implementation-plan", async () => {
        execution.plan = await this.generateImplementationPlan(execution);
        this.appendConsole(
          "result",
          "Plan generado",
          execution.plan
            .map(
              (step) =>
                `${step.action.toUpperCase()} ${step.file} (${step.estimatedLines} lineas estimadas)`,
            )
            .join(" | "),
        );
      });

      await this.runStage(execution, "parallel-coding", async () => {
        const maxConcurrency = Math.min(
          deriveEffectiveParallelism(this.snapshot.config),
          Math.max(1, execution.plan.length),
        );

        const tasks = execution.plan.map((step, index) => ({
          name: step.file,
          fn: async () => this.implementPlanStep(execution, step, index),
        }));

        if (tasks.length === 0) {
          throw new Error("El plan no contiene archivos ejecutables.");
        }

        await runWithConcurrency(tasks, maxConcurrency);

        if (execution.modifiedFiles.size === 0) {
          throw new Error("No se aplicaron cambios reales durante la fase de codificacion.");
        }

        this.appendConsole(
          "result",
          "Codificacion completada",
          `Se actualizaron ${execution.modifiedFiles.size} archivos con ${execution.linesChanged} lineas modificadas.`,
        );
      });

      await this.runStage(execution, "code-review", async () => {
        execution.review = await this.reviewChanges(execution);

        if (execution.review.issues.length > 0) {
          for (const issue of execution.review.issues) {
            if (issue.severity === "critical") {
              execution.warnings.push(`${issue.file}: ${issue.description}`);
            }
          }
        }

        if (execution.review.decision === "reject") {
          throw new Error(
            execution.review.summary || "La revision tecnica rechazo los cambios generados.",
          );
        }

        this.appendConsole(
          "result",
          "Revision aprobada",
          execution.review.summary,
        );
      });

      await this.runStage(execution, "qa-validation", async () => {
        await this.runQaChecks(execution);
        this.appendConsole(
          "result",
          "QA completado",
          execution.qaChecks
            .map((check) => `${check.label}: ${check.result}`)
            .join(" | "),
        );
      });

      await this.runStage(execution, "intelligence-report", async () => {
        execution.validations = execution.qaChecks.map(
          (check) => `${check.label}: ${check.details}`,
        );
        this.snapshot.state = {
          ...this.snapshot.state,
          report: await this.buildRunReport(execution, "completed"),
          updatedAt: nowIso(),
        };
        this.emit();
      });

      await this.finalizeRun(execution, "completed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "La ejecucion autonoma fallo.";
      const status = error instanceof AutodevAbortError ? "aborted" : "failed";
      await this.finalizeRun(execution, status, message);
    }
  }

  private async runStage(
    execution: RuntimeExecution,
    stageId: AutodevStageId,
    work: () => Promise<void>,
  ): Promise<void> {
    this.checkAbort();

    const startedAt = nowIso();
    const stageTitle =
      this.snapshot.state.stages.find((stage) => stage.id === stageId)?.title ??
      stageId;

    this.snapshot.state = {
      ...this.snapshot.state,
      currentStageId: stageId,
      updatedAt: startedAt,
      stages: this.snapshot.state.stages.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              status: "running",
              startedAt,
              completedAt: null,
            }
          : stage,
      ),
    };
    this.appendConsole(
      "phase",
      stageTitle,
      `Iniciando fase ${stageTitle.toLowerCase()}.`,
    );
    this.emit();

    try {
      await work();
      this.checkAbort();

      const completedAt = nowIso();
      this.snapshot.state = {
        ...this.snapshot.state,
        updatedAt: completedAt,
        stages: this.snapshot.state.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                status: "completed",
                completedAt,
              }
            : stage,
        ),
      };
      this.emit();
    } catch (error) {
      const completedAt = nowIso();
      this.snapshot.state = {
        ...this.snapshot.state,
        updatedAt: completedAt,
        stages: this.snapshot.state.stages.map((stage) =>
          stage.id === stageId
            ? {
                ...stage,
                status: "blocked",
                completedAt,
              }
            : stage,
        ),
      };

      const isAbort = error instanceof AutodevAbortError;
      this.appendConsole(
        isAbort ? "warning" : "error",
        `${stageTitle} ${isAbort ? "interrumpido" : "fallo"}`,
        error instanceof Error ? error.message : "Error desconocido.",
      );
      this.emit();
      throw error;
    }
  }

  private async scanRepository(
    context: AutodevRunRequest,
  ): Promise<RepositoryScanResult> {
    if (!context.localPath) {
      throw new Error(
        "No hay un repositorio local asignado. Usa el boton Repositorio fuente para seleccionar una carpeta.",
      );
    }

    const repoPath = resolve(context.localPath);
    if (!existsSync(repoPath)) {
      throw new Error(`La ruta del repositorio no existe: ${repoPath}`);
    }

    const files: RepoFileDescriptor[] = [];
    const existingFiles = new Set<string>();

    const walk = (currentPath: string): void => {
      this.checkAbort();
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relPath = normalizePath(relative(repoPath, fullPath));

        if (!relPath || relPath.startsWith("..")) {
          continue;
        }

        if (entry.isDirectory()) {
          if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) {
            continue;
          }
          walk(fullPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        let stats;
        try {
          stats = statSync(fullPath);
        } catch {
          continue;
        }

        existingFiles.add(relPath);
        files.push({
          path: relPath,
          fullPath,
          ext: extname(entry.name).toLowerCase(),
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          priority: computePriority(relPath),
        });
      }
    };

    walk(repoPath);

    files.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      if (left.size !== right.size) {
        return left.size - right.size;
      }
      return left.path.localeCompare(right.path);
    });

    const contextFiles: RepoContextFile[] = [];
    let consumedChars = 0;

    for (const file of files) {
      if (
        contextFiles.length >= MAX_CONTEXT_FILES ||
        consumedChars >= MAX_CONTEXT_CHARS ||
        !isTextFile(file.path) ||
        file.size > 120_000
      ) {
        continue;
      }

      try {
        const content = readFileSync(file.fullPath, "utf-8");
        if (!content.trim()) {
          continue;
        }

        const remainingChars = MAX_CONTEXT_CHARS - consumedChars;
        const normalizedContent =
          content.length > remainingChars ? content.slice(0, remainingChars) : content;

        contextFiles.push({
          ...file,
          content: normalizedContent,
        });
        consumedChars += normalizedContent.length;
      } catch {
        // Ignore unreadable files and continue scanning.
      }
    }

    const packageJson = safeReadJson(join(repoPath, "package.json"));
    const packageManager: "npm" | "pnpm" | "yarn" = existsSync(
      join(repoPath, "pnpm-lock.yaml"),
    )
      ? "pnpm"
      : existsSync(join(repoPath, "yarn.lock"))
        ? "yarn"
        : "npm";

    return {
      repoPath,
      fileCount: files.length,
      directoryCount: countDistinctDirectories(files),
      files,
      contextFiles,
      existingFiles,
      packageJson,
      packageManager,
    };
  }

  private async loadKnowledgeDocuments(
    execution: RuntimeExecution,
  ): Promise<Array<{ path: string; content: string; excerpt: string }>> {
    const scan = execution.scan;
    if (!scan) {
      return [];
    }

    const candidateFiles = new Set<string>();
    const repoRoot = scan.repoPath;
    const knownRepoDocs = [
      "README.md",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "docs/README.md",
    ];

    for (const file of knownRepoDocs) {
      const fullPath = join(repoRoot, file);
      if (existsSync(fullPath)) {
        candidateFiles.add(fullPath);
      }
    }

    const docsDir = join(repoRoot, "docs");
    if (existsSync(docsDir)) {
      const walkDocs = (currentPath: string): void => {
        const entries = readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(currentPath, entry.name);
          if (entry.isDirectory()) {
            walkDocs(fullPath);
            continue;
          }
          if (entry.isFile() && isTextFile(fullPath)) {
            candidateFiles.add(fullPath);
          }
        }
      };
      walkDocs(docsDir);
    }

    for (const workspaceDoc of [
      join(process.cwd(), "AQELOR_documentacion_funcional_escalabilidad.md"),
      join(process.cwd(), "prd_auria.md"),
    ]) {
      if (existsSync(workspaceDoc)) {
        candidateFiles.add(workspaceDoc);
      }
    }

    const documents: Array<{ path: string; content: string; excerpt: string }> = [];
    let consumedChars = 0;

    for (const fullPath of candidateFiles) {
      if (consumedChars >= MAX_CONTEXT_CHARS / 2) {
        break;
      }

      try {
        const rawContent = readFileSync(fullPath, "utf-8").trim();
        if (!rawContent) {
          continue;
        }

        const remainingChars = MAX_CONTEXT_CHARS / 2 - consumedChars;
        const content =
          rawContent.length > remainingChars
            ? rawContent.slice(0, remainingChars)
            : rawContent;
        const label = normalizePath(
          fullPath.startsWith(repoRoot)
            ? relative(repoRoot, fullPath)
            : relative(process.cwd(), fullPath),
        );

        documents.push({
          path: label,
          content,
          excerpt: truncate(stripHtml(content), MAX_DOC_CHARS),
        });
        consumedChars += content.length;
      } catch {
        // Ignore doc read failures.
      }
    }

    return documents;
  }

  private async summarizeProjectMemory(
    execution: RuntimeExecution,
  ): Promise<string> {
    await this.ensureAiStageReady("project-memory");

    return truncate(
      await this.generateTextPrompt(
        [
          "Eres el analista de memoria de proyecto de AURIA.",
          `Repositorio: ${execution.repoLabel}`,
          `Objetivo: ${execution.objective}`,
          "Construye un resumen operativo del proyecto usando el codigo indexado y la memoria persistente.",
          "Debes responder en espanol con: arquitectura principal, modulos clave, restricciones detectadas y riesgos inmediatos.",
          `Memoria previa:\n${buildMemorySummary(execution.memory)}`,
          `Contexto indexado:\n${buildContextBundle(execution, 50_000)}`,
        ].join("\n\n"),
        this.snapshot.config.models.planning,
      ),
      1_400,
    );
  }

  private async summarizeKnowledgeIntake(
    execution: RuntimeExecution,
  ): Promise<string> {
    await this.ensureAiStageReady("knowledge-intake");

    return truncate(
      await this.generateTextPrompt(
        [
          "Eres el analista de contexto documental de AURIA.",
          `Repositorio: ${execution.repoLabel}`,
          `Objetivo: ${execution.objective}`,
          "Resume el contexto adicional incorporado por README, PRD y otros documentos.",
          "Debes responder en espanol con: documentos usados, reglas de negocio relevantes y decisiones que deben condicionar la implementacion.",
          `Documentos:\n${buildDocumentsBundle(execution.documents.slice(0, 8))}`,
        ].join("\n\n"),
        this.snapshot.config.models.planning,
      ),
      1_400,
    );
  }

  private async generateResearchQueries(
    execution: RuntimeExecution,
  ): Promise<string[]> {
    await this.ensureAiStageReady("web-research");

    const categories = derivePromptCategories(this.snapshot.config.enabledToolSlugs);
    const dependencies = extractDependencyList(execution.scan?.packageJson).slice(0, 8);
    const response = await this.generateJsonPrompt<{
      queries?: Array<{ query?: string }>;
    }>(
      [
        "Genera consultas de investigacion web para un run autonomo de AURIA.",
        `Repositorio: ${execution.repoLabel}`,
        `Objetivo: ${execution.objective}`,
        `Categorias: ${categories.join(", ")}`,
        `Dependencias clave: ${dependencies.join(", ") || "n/d"}`,
        "Devuelve JSON con la forma:",
        '{ "queries": [ { "query": "texto" } ] }',
        `Maximo ${MAX_RESEARCH_QUERIES} queries.`,
        "Prioriza queries accionables, especificas y recientes.",
      ].join("\n"),
      this.snapshot.config.models.research,
    );

    const queries = (response?.queries ?? [])
      .map((entry) => (typeof entry?.query === "string" ? entry.query.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_RESEARCH_QUERIES);

    if (queries.length === 0) {
      throw new Error(
        "El agente de investigacion no devolvio queries validas. Configura el modelo o revisa las credenciales.",
      );
    }

    return queries;
  }

  private async searchWeb(
    query: string,
    agentLabel: string,
    signal?: AbortSignal,
  ): Promise<RuntimeResearchQuery> {
    this.checkAbort();
    this.appendConsole(
      "command",
      `Consulta web ${agentLabel}`,
      query,
      `GET https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    );

    try {
      const response = await fetch(
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "Auria-Autodev/1.0",
          },
          signal,
        },
      );

      const html = await response.text();
      const urls = extractSearchUrls(html);
      const pageSummary = urls[0] ? await this.readWebPage(urls[0], signal) : "";
      const excerpt = truncate(stripHtml(html), 900);

      return {
        query,
        urls,
        summary: pageSummary || excerpt,
        excerpt,
      };
    } catch (error) {
      return {
        query,
        urls: [],
        summary:
          error instanceof Error
            ? `Busqueda no disponible: ${error.message}`
            : "Busqueda no disponible.",
        excerpt: "",
      };
    }
  }

  private async readWebPage(url: string, signal?: AbortSignal): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Auria-Autodev/1.0" },
        signal,
      });
      const body = await response.text();
      return truncate(stripHtml(body), 1_200);
    } catch {
      return "";
    }
  }

  private async summarizeResearch(
    execution: RuntimeExecution,
  ): Promise<RuntimeResearchFinding[]> {
    if (execution.researchData.length === 0) {
      return [];
    }

    const response = await this.generateJsonPrompt<{
      findings?: Array<{
        query?: string;
        category?: string;
        findings?: string;
        actionable?: boolean;
        sources?: string[];
      }>;
    }>(
      [
        "Resume la investigacion web de AURIA en hallazgos accionables.",
        `Objetivo: ${execution.objective}`,
        `Datos brutos:\n${JSON.stringify(execution.researchData, null, 2)}`,
        "Devuelve JSON con la forma:",
        '{ "findings": [ { "query": "...", "category": "...", "findings": "...", "actionable": true, "sources": ["https://..."] } ] }',
      ].join("\n\n"),
      this.snapshot.config.models.research,
    );

    const findings = (response?.findings ?? [])
      .map((finding) => ({
        query:
          typeof finding?.query === "string" && finding.query.trim()
            ? finding.query.trim()
            : execution.researchData[0]?.query ?? "research",
        category:
          typeof finding?.category === "string" && finding.category.trim()
            ? finding.category.trim()
            : "quality",
        findings:
          typeof finding?.findings === "string" && finding.findings.trim()
            ? finding.findings.trim()
            : "",
        actionable: Boolean(finding?.actionable),
        sources: Array.isArray(finding?.sources)
          ? finding.sources.filter((source): source is string => typeof source === "string")
          : [],
      }))
      .filter((finding) => finding.findings);

    if (findings.length === 0) {
      throw new Error(
        "El agente de investigacion no devolvio hallazgos validos. No se completara research con fallback local.",
      );
    }

    return findings;
  }

  private async generateImplementationPlan(
    execution: RuntimeExecution,
  ): Promise<PlanStep[]> {
    const scan = execution.scan;
    if (!scan) {
      throw new Error("No existe un escaneo del repositorio para planificar.");
    }

    const prompt = [
      "Eres el planner autonomo de AURIA.",
      `Objetivo general: ${execution.objective}`,
      `Repositorio: ${execution.repoLabel}`,
      `Rama objetivo: ${execution.context.repoBranch ?? this.snapshot.config.targetBranch}`,
      `Paquete: ${scan.packageManager}`,
      `Maximo de archivos: ${this.snapshot.config.maxFilesPerRun}`,
      `Maximo de lineas modificadas: ${this.snapshot.config.maxLinesChanged}`,
      `Herramientas activas: ${this.snapshot.config.enabledToolSlugs.join(", ") || "ninguna"}`,
      `Dependencias detectadas: ${extractDependencyList(scan.packageJson).join(", ") || "n/d"}`,
      `Documentacion:\n${execution.documents.map((document) => `- ${document.path}: ${truncate(document.excerpt, 250)}`).join("\n") || "Sin documentos"}`,
      `Investigacion:\n${buildResearchSummary(execution.researchFindings)}`,
      `Memoria:\n${buildMemorySummary(execution.memory)}`,
      "Contexto de codigo relevante:",
      buildContextBundle(execution, 120_000),
      "Reglas estrictas:",
      "- Solo acciones create o modify",
      "- No agregar comandos shell",
      "- No instalar dependencias",
      "- No cambiar major versions",
      "- Cada paso debe ser compilable y realista",
      "Devuelve JSON con la forma:",
      '{ "plan": [ { "file": "src/...", "action": "modify|create", "category": "quality|documentation|security|performance|features|tests", "description": "que hara", "details": "instruccion detallada", "estimatedLines": 120, "source": "research/doc/memory" } ] }',
    ].join("\n\n");

    const response = await this.generateJsonPrompt<{ plan?: unknown }>(
      prompt,
      this.snapshot.config.models.planning,
    );

    const rawPlan = response?.plan ?? response;
    const sanitized = sanitizePlanSteps(rawPlan, this.snapshot.config.maxFilesPerRun);
    const aggregated = aggregatePlanSteps(sanitized);

    let estimatedTotal = 0;
    const finalPlan: PlanStep[] = [];

    for (const step of aggregated) {
      if (estimatedTotal >= this.snapshot.config.maxLinesChanged) {
        break;
      }

      const estimatedLines = Math.max(1, Math.min(step.estimatedLines, 800));
      if (
        estimatedTotal + estimatedLines >
        this.snapshot.config.maxLinesChanged + 120
      ) {
        execution.warnings.push(
          `Se omitio ${step.file} para respetar el presupuesto maximo de lineas.`,
        );
        continue;
      }

      estimatedTotal += estimatedLines;
      finalPlan.push({
        file: step.file,
        action: step.action,
        category: step.category,
        description: step.description,
        details: step.details,
        estimatedLines,
        source: step.sources.join(", "),
      });
    }

    if (finalPlan.length === 0) {
      throw new Error("El plan generado no contiene cambios ejecutables.");
    }

    return finalPlan;
  }

  private async implementPlanStep(
    execution: RuntimeExecution,
    step: PlanStep,
    index: number,
  ): Promise<void> {
    const scan = execution.scan;
    if (!scan) {
      throw new Error("No hay contexto de repositorio para codificar.");
    }

    this.checkAbort();

    const repoRoot = execution.repoPath;
    const fullPath = resolve(repoRoot, step.file);
    const normalizedRepoRoot = normalizePath(repoRoot);
    const normalizedFullPath = normalizePath(fullPath);
    if (
      normalizedFullPath !== normalizedRepoRoot &&
      !normalizedFullPath.startsWith(`${normalizedRepoRoot}/`)
    ) {
      throw new Error(`La ruta objetivo sale del repositorio: ${step.file}`);
    }

    const exists = existsSync(fullPath);
    const before = exists ? readFileSync(fullPath, "utf-8") : "";
    const relatedContext = pickRelatedContext(scan, step.file)
      .map((file) => `// ${file.path}\n${file.content}`)
      .join("\n\n");

    this.upsertLiveFile({
      path: step.file,
      status: "reading",
      summary: `${step.action === "create" ? "Preparando archivo nuevo" : "Analizando archivo"}: ${step.description}`,
      lineRange: "1-1",
      linesTouched: 0,
      agent: `Coder ${index + 1}`,
      excerpt: truncate(before || step.details, 400),
    });
    this.appendConsole(
      "command",
      `Coder ${index + 1}`,
      `${step.action.toUpperCase()} ${step.file}`,
    );

    const prompt = [
      "Eres un agente coder autonomo de AURIA.",
      `Objetivo global: ${execution.objective}`,
      `Archivo objetivo: ${step.file}`,
      `Accion: ${step.action}`,
      `Categoria: ${step.category}`,
      `Descripcion: ${step.description}`,
      `Detalles del planner: ${step.details}`,
      `Presupuesto estimado para este archivo: ${step.estimatedLines} lineas`,
      "Reglas estrictas:",
      "- Responde solo JSON valido",
      "- Devuelve el archivo completo en modifiedCode",
      "- No dejes TODO, ..., codigo truncado ni pseudocodigo",
      "- Mantén imports validos",
      "- No cambies versiones de package.json",
      "- Respeta el estilo y convenciones del archivo",
      `Contenido actual del archivo:\n${before || "// archivo nuevo"}`,
      `Contexto relacionado:\n${relatedContext || "// sin contexto relacionado"}`,
      `Documentacion de soporte:\n${buildDocumentsBundle(execution.documents.slice(0, 6))}`,
      `Investigacion accionable:\n${buildResearchSummary(execution.researchFindings)}`,
      "Salida JSON requerida:",
      '{ "summary": "resumen breve", "modifiedCode": "codigo completo del archivo", "notes": ["opcional"] }',
    ].join("\n\n");

    const response = await this.generateJsonPrompt<{
      summary?: string;
      modifiedCode?: string;
      code?: string;
      notes?: string[];
    }>(
      prompt,
      this.snapshot.config.models.coding,
    );

    const after =
      (typeof response?.modifiedCode === "string" && response.modifiedCode) ||
      (typeof response?.code === "string" && response.code) ||
      "";

    if (!after.trim()) {
      throw new Error(`El modelo no devolvio codigo util para ${step.file}.`);
    }

    const completeness = isCodeComplete(after);
    if (!completeness.passed) {
      throw new Error(`${step.file}: ${completeness.reason}`);
    }

    if (step.file === "package.json" && before) {
      const packageGuard = hasMajorVersionBump(before, after);
      if (!packageGuard.passed) {
        throw new Error(packageGuard.reason);
      }
    }

    const phantomImports = findPhantomImports(
      after,
      new Set([...scan.existingFiles, step.file]),
      normalizePath(step.file),
    );
    if (phantomImports.length > 0) {
      throw new Error(
        `${step.file}: imports relativos inexistentes detectados (${phantomImports.join(", ")}).`,
      );
    }

    const diff = await this.computeDiff(step.file, before, after);
    const linesChanged = diff
      .split(/\r?\n/)
      .filter(
        (line) =>
          (line.startsWith("+") || line.startsWith("-")) &&
          !line.startsWith("+++") &&
          !line.startsWith("---"),
      ).length;

    if (execution.linesChanged + linesChanged > this.snapshot.config.maxLinesChanged) {
      throw new Error(
        `El cambio de ${step.file} excede el limite maximo de lineas del run.`,
      );
    }

    ensureDirectory(dirname(fullPath));
    writeFileSync(fullPath, after, "utf-8");
    scan.existingFiles.add(step.file);

    execution.linesChanged += linesChanged;
    execution.modifiedFiles.set(step.file, {
      path: step.file,
      fullPath,
      action: exists ? "modify" : "create",
      category: step.category,
      description: step.description,
      before,
      after,
      linesChanged,
      diff,
    });

    this.upsertLiveFile({
      path: step.file,
      status: "writing",
      summary:
        typeof response?.summary === "string" && response.summary.trim()
          ? response.summary.trim()
          : step.description,
      lineRange: `1-${Math.max(1, after.split(/\r?\n/).length)}`,
      linesTouched: linesChanged,
      agent: `Coder ${index + 1}`,
      excerpt: truncate(after, 450),
    });

    this.appendConsole(
      "result",
      `Archivo ${exists ? "modificado" : "creado"}`,
      `${step.file} actualizado (${linesChanged} lineas tocadas).`,
    );
  }

  private async reviewChanges(
    execution: RuntimeExecution,
  ): Promise<RuntimeReviewResult> {
    const diff = [...execution.modifiedFiles.values()]
      .map((change) => `# ${change.path}\n${change.diff}`)
      .join("\n\n")
      .slice(0, 100_000);

    if (!diff.trim()) {
      return {
        decision: "approve",
        summary: "No hubo diff material para revisar.",
        issues: [],
      };
    }

    try {
      const prompt = REVIEW_PROMPT
        .replace("{DIFF}", diff)
        .replace(
          "{IMPROVEMENTS_APPLIED}",
          execution.plan
            .map(
              (step) =>
                `- [${step.category}] ${step.file}: ${step.description} (${step.details})`,
            )
            .join("\n"),
        )
        .replace("{RESEARCH_SOURCES}", buildResearchSummary(execution.researchFindings));

      const response = await this.generateJsonPrompt<{
        decision?: "approve" | "reject";
        summary?: string;
        issues?: Array<{
          severity?: "critical" | "warning" | "info";
          file?: string;
          description?: string;
          suggestion?: string;
        }>;
      }>(prompt, this.snapshot.config.models.review);

      const issues = (response?.issues ?? []).map((issue) => ({
        severity:
          issue?.severity === "critical" ||
          issue?.severity === "warning" ||
          issue?.severity === "info"
            ? issue.severity
            : "warning",
        file: typeof issue?.file === "string" ? issue.file : "unknown",
        description:
          typeof issue?.description === "string"
            ? issue.description
            : "Issue sin descripcion.",
        suggestion:
          typeof issue?.suggestion === "string" ? issue.suggestion : "Revisar manualmente.",
      }));

      const decision =
        response?.decision === "reject" &&
        issues.some((issue) => issue.severity === "critical")
          ? "reject"
          : "approve";

      return {
        decision,
        summary:
          typeof response?.summary === "string" && response.summary.trim()
            ? response.summary.trim()
            : decision === "approve"
              ? "Revision automatica aprobada."
              : "Revision automatica rechazo los cambios.",
        issues,
      };
    } catch (error) {
      execution.warnings.push(
        `Revision con modelo no disponible, se uso fallback local: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      );

      const localIssues: RuntimeReviewResult["issues"] = [];
      for (const change of execution.modifiedFiles.values()) {
        const completeness = isCodeComplete(change.after);
        if (!completeness.passed) {
          localIssues.push({
            severity: "critical",
            file: change.path,
            description: completeness.reason,
            suggestion: "Regenerar el archivo completo.",
          });
        }
      }

      return {
        decision: localIssues.some((issue) => issue.severity === "critical")
          ? "reject"
          : "approve",
        summary:
          localIssues.length > 0
            ? "La revision local detecto problemas criticos."
            : "Revision local aprobada sin hallazgos criticos.",
        issues: localIssues,
      };
    }
  }

  private async runQaChecks(execution: RuntimeExecution): Promise<void> {
    const scan = execution.scan;
    if (!scan) {
      throw new Error("No se puede ejecutar QA sin escaneo de repositorio.");
    }

    const qaChecks: AutodevQaCheck[] = [];
    const scripts =
      scan.packageJson && typeof scan.packageJson.scripts === "object"
        ? (scan.packageJson.scripts as Record<string, unknown>)
        : {};

    if (typeof scripts.build === "string") {
      qaChecks.push(await this.runPackageScript("build", execution.repoPath, scan.packageManager));
    } else {
      qaChecks.push({
        id: "build",
        label: "Build",
        result: "warning",
        details: "El repositorio no define un script build.",
      });
    }

    qaChecks.push(await this.runTypecheck(execution));

    if (typeof scripts.lint === "string") {
      qaChecks.push(await this.runLint(execution));
    } else {
      qaChecks.push({
        id: "lint",
        label: "Lint",
        result: "warning",
        details: "El repositorio no define un script lint.",
      });
    }

    const orphanWarnings = this.detectOrphanFiles(execution);
    qaChecks.push({
      id: "orphan-files",
      label: "Archivos huerfanos",
      result: orphanWarnings.length > 0 ? "warning" : "passed",
      details:
        orphanWarnings.length > 0
          ? orphanWarnings.join(" | ")
          : "No se detectaron archivos nuevos sin referencias aparentes.",
    });

    execution.qaChecks = qaChecks;
    execution.validations = qaChecks.map((check) => `${check.label}: ${check.details}`);

    const failedChecks = qaChecks.filter((check) => check.result === "failed");
    if (failedChecks.length > 0) {
      throw new Error(
        `QA detecto fallas: ${failedChecks.map((check) => check.label).join(", ")}`,
      );
    }
  }

  private async runTypecheck(
    execution: RuntimeExecution,
  ): Promise<AutodevQaCheck> {
    const scan = execution.scan;
    if (!scan) {
      return {
        id: "typecheck",
        label: "Typecheck",
        result: "warning",
        details: "No hubo escaneo disponible para ejecutar typecheck.",
      };
    }

    const scripts =
      scan.packageJson && typeof scan.packageJson.scripts === "object"
        ? (scan.packageJson.scripts as Record<string, unknown>)
        : {};

    if (typeof scripts.typecheck === "string") {
      return this.runPackageScript("typecheck", execution.repoPath, scan.packageManager);
    }

    const tscBinary = join(
      execution.repoPath,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tsc.cmd" : "tsc",
    );

    if (!existsSync(join(execution.repoPath, "tsconfig.json")) || !existsSync(tscBinary)) {
      return {
        id: "typecheck",
        label: "Typecheck",
        result: "warning",
        details: "No existe script typecheck ni binario local de TypeScript.",
      };
    }

    const result = await this.runCommand(
      `"${tscBinary}" --noEmit`,
      execution.repoPath,
      120_000,
    );

    if (result.exitCode === 0) {
      return {
        id: "typecheck",
        label: "Typecheck",
        result: "passed",
        details: "TypeScript no reporto errores.",
      };
    }

    const parsedErrors = parseBuildErrors(`${result.stdout}\n${result.stderr}`);
    return {
      id: "typecheck",
      label: "Typecheck",
      result: "failed",
      details:
        parsedErrors[0]?.message ||
        truncate(`${result.stdout}\n${result.stderr}`.trim(), 240),
    };
  }

  private async runLint(execution: RuntimeExecution): Promise<AutodevQaCheck> {
    const scan = execution.scan;
    if (!scan) {
      return {
        id: "lint",
        label: "Lint",
        result: "warning",
        details: "No hubo escaneo disponible para ejecutar lint.",
      };
    }

    return this.runPackageScript("lint", execution.repoPath, scan.packageManager);
  }

  private detectOrphanFiles(execution: RuntimeExecution): string[] {
    const warnings: string[] = [];
    const scan = execution.scan;
    if (!scan) {
      return warnings;
    }

    const contentPool = new Map<string, string>();
    for (const file of scan.contextFiles) {
      contentPool.set(file.path, file.content);
    }
    for (const change of execution.modifiedFiles.values()) {
      contentPool.set(change.path, change.after);
    }

    for (const change of execution.modifiedFiles.values()) {
      if (
        change.action !== "create" ||
        !/\.(ts|tsx|js|jsx)$/.test(change.path) ||
        /(^|\/)(index|main|app|page|layout|route)\.(ts|tsx|js|jsx)$/.test(change.path)
      ) {
        continue;
      }

      let referenced = false;
      for (const [consumerPath, consumerContent] of contentPool.entries()) {
        if (consumerPath === change.path) {
          continue;
        }

        const relImport = cleanupImportPath(
          normalizePath(relative(dirname(consumerPath), change.path)),
        );
        const importCandidate = relImport.startsWith(".") ? relImport : `./${relImport}`;

        if (
          consumerContent.includes(`"${importCandidate}"`) ||
          consumerContent.includes(`'${importCandidate}'`)
        ) {
          referenced = true;
          break;
        }
      }

      if (!referenced) {
        warnings.push(`${change.path} no tiene referencias aparentes.`);
      }
    }

    return warnings;
  }

  private async buildRunReport(
    execution: RuntimeExecution,
    status: "completed" | "failed" | "aborted",
    errorMessage?: string,
  ): Promise<AutodevRunReport> {
    const files = [...execution.modifiedFiles.values()].map((change) => ({
      path: change.path,
      lines: change.linesChanged,
      action: change.action === "create" ? "Archivo nuevo" : "Archivo modificado",
    }));

    let resultSummary = buildFallbackSummary(execution, status, errorMessage);

    try {
      const prompt = SUMMARY_PROMPT
        .replace(
          "{RUN_INFO}",
          JSON.stringify(
            {
              runId: execution.runId,
              objective: execution.objective,
              status,
              startedAt: new Date(execution.startedAtMs).toISOString(),
              durationMinutes: Math.max(
                1,
                Math.round((Date.now() - execution.startedAtMs) / 60_000),
              ),
              filesModified: execution.modifiedFiles.size,
              linesModified: execution.linesChanged,
              repo: execution.repoLabel,
              prUrl: null,
            },
            null,
            2,
          ),
        )
        .replace(
          "{IMPROVEMENTS}",
          files
            .map(
              (file) =>
                `- ${file.path}: ${file.action} (${file.lines} lineas)`,
            )
            .join("\n") || "Sin cambios aplicados.",
        )
        .replace("{RESEARCH_FINDINGS}", buildResearchSummary(execution.researchFindings));

      resultSummary = truncate(
        await this.generateTextPrompt(prompt, this.snapshot.config.models.review),
        3_000,
      );
    } catch (error) {
      execution.warnings.push(
        `El informe detallado uso fallback local: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      );
    }

    return {
      objective: execution.objective,
      resultSummary,
      filesModified: execution.modifiedFiles.size,
      linesModified: execution.linesChanged,
      filesRead: execution.filesRead,
      selectedTools: [...this.snapshot.config.enabledToolSlugs],
      documentsUsed: execution.documents.map((document) => document.path),
      researchQueries: [...execution.researchQueries],
      validations: [...execution.validations],
      warnings: [...execution.warnings],
      files,
      qaChecks: execution.qaChecks.map((check) => ({ ...check })),
    };
  }

  private async finalizeRun(
    execution: RuntimeExecution,
    status: "completed" | "failed" | "aborted",
    errorMessage?: string,
  ): Promise<void> {
    const completedAt = nowIso();

    if (!this.snapshot.state.report) {
      this.snapshot.state = {
        ...this.snapshot.state,
        report: await this.buildRunReport(execution, status, errorMessage),
      };
    }

    this.snapshot.state = {
      ...this.snapshot.state,
      running: false,
      status,
      currentStageId: null,
      completedAt,
      updatedAt: completedAt,
      lastError: status === "completed" ? null : errorMessage ?? "Ejecucion fallida.",
      liveFiles: this.snapshot.state.liveFiles.map((file) => ({
        ...file,
        status:
          status === "completed"
            ? "completed"
            : file.status === "completed"
              ? "completed"
              : "reviewing",
        updatedAt: completedAt,
      })),
      stages: this.snapshot.state.stages.map((stage) =>
        stage.status === "pending"
          ? {
              ...stage,
              status: status === "completed" ? "completed" : "blocked",
              completedAt: stage.completedAt ?? completedAt,
            }
          : stage,
      ),
    };

    const report = this.snapshot.state.report;
    const summary =
      report?.resultSummary ||
      buildFallbackSummary(execution, status, errorMessage);

    this.history = [
      {
        id: execution.runId,
        status,
        triggerSource: execution.context.triggerSource ?? "manual",
        startedAt: new Date(execution.startedAtMs).toISOString(),
        completedAt,
        summary,
        filesModified: execution.modifiedFiles.size,
        linesModified: execution.linesChanged,
        objective: execution.objective,
      },
      ...this.history,
    ].slice(0, MAX_REPORT_HISTORY);

    this.saveHistory();
    this.persistRepoMemory(execution, status, summary);

    this.appendConsole(
      status === "completed" ? "result" : status === "aborted" ? "warning" : "error",
      `Run ${status === "completed" ? "finalizado" : status === "aborted" ? "abortado" : "fallido"}`,
      summary,
    );

    this.abortController = null;
    this.emit();
  }

  private async runPackageScript(
    scriptName: string,
    cwd: string,
    packageManager: "npm" | "pnpm" | "yarn",
  ): Promise<AutodevQaCheck> {
    const baseCommand =
      packageManager === "pnpm"
        ? `pnpm ${scriptName}`
        : packageManager === "yarn"
          ? `yarn ${scriptName}`
          : `npm run ${scriptName}`;

    const result = await this.runCommand(baseCommand, cwd, 180_000);

    if (result.exitCode === 0) {
      return {
        id: scriptName,
        label: scriptName === "build" ? "Build" : scriptName === "lint" ? "Lint" : "Typecheck",
        result: "passed",
        details: `${scriptName} finalizo correctamente.`,
      };
    }

    const parsedErrors = parseBuildErrors(`${result.stdout}\n${result.stderr}`);
    return {
      id: scriptName,
      label: scriptName === "build" ? "Build" : scriptName === "lint" ? "Lint" : "Typecheck",
      result: "failed",
      details:
        parsedErrors[0]?.message ||
        truncate(`${result.stdout}\n${result.stderr}`.trim(), 240),
    };
  }

  private async runCommand(
    command: string,
    cwd: string,
    timeoutMs = 120_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.appendConsole("command", "Ejecucion local", command, command);

    try {
      const result = await execFileAsync(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", command],
        {
          cwd,
          windowsHide: true,
          timeout: timeoutMs,
          maxBuffer: 16 * 1024 * 1024,
        },
      );

      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        stdout: error?.stdout ?? "",
        stderr: error?.stderr ?? error?.message ?? "",
        exitCode: typeof error?.code === "number" ? error.code : 1,
      };
    }
  }

  private async computeDiff(
    filePath: string,
    before: string,
    after: string,
  ): Promise<string> {
    const beforePath = join(
      TEMP_DIFF_DIR,
      `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_before.tmp`,
    );
    const afterPath = join(
      TEMP_DIFF_DIR,
      `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_after.tmp`,
    );

    try {
      writeFileSync(beforePath, before, "utf-8");
      writeFileSync(afterPath, after, "utf-8");

      const result = await this.runCommand(
        `git diff --no-index --unified=2 -- "${beforePath}" "${afterPath}"`,
        TEMP_DIFF_DIR,
        30_000,
      );

      if (result.stdout.trim()) {
        return result.stdout
          .replace(new RegExp(escapeRegExp(beforePath), "g"), `a/${filePath}`)
          .replace(new RegExp(escapeRegExp(afterPath), "g"), `b/${filePath}`);
      }
    } catch {
      // Ignore and fall back to naive diff below.
    } finally {
      cleanupFile(beforePath);
      cleanupFile(afterPath);
    }

    return [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      ...before.split(/\r?\n/).map((line) => `-${line}`),
      ...after.split(/\r?\n/).map((line) => `+${line}`),
    ].join("\n");
  }

  /* ─── AI Client Initialization ──────────────────────────────────── */

  private async ensureGeminiClient(): Promise<any> {
    if (this.geminiClient) {
      return this.geminiClient;
    }

    const apiKey = await this.resolveGeminiApiKey();
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    this.geminiApiKey = apiKey;
    this.geminiClient = new GoogleGenerativeAI(apiKey);
    return this.geminiClient;
  }

  private async ensureAiStageReady(stageId: AutodevStageId): Promise<void> {
    try {
      await this.ensureGeminiClient();
    } catch (error) {
      const stage =
        this.snapshot.state.stages.find((item) => item.id === stageId)?.title ?? stageId;
      const detail =
        error instanceof Error ? error.message : "No hay modelo operativo disponible.";
      throw new Error(
        `La fase "${stage}" requiere un agente de IA configurado y operativo. ${detail}`,
      );
    }
  }

  private async resolveGeminiApiKey(): Promise<string> {
    if (this.geminiApiKey) {
      return this.geminiApiKey;
    }

    const envKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_API_KEY,
      process.env.AURIA_GEMINI_API_KEY,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (envKeys[0]) {
      this.geminiApiKey = envKeys[0];
      return envKeys[0];
    }

    const resolverKeys = [
      "auria-gemini-api-key",
      "gemini-api-key",
      "google-api-key",
    ];

    for (const key of resolverKeys) {
      const value = this.secretResolver?.(key);
      if (value && value.trim()) {
        this.geminiApiKey = value.trim();
        return this.geminiApiKey;
      }
    }

    throw new Error(
      "No se encontro una API key de Gemini. Configura tu API key en Settings > API Keys, o verifica que la key por defecto este activa en la base de datos.",
    );
  }

  /* ─── Model Resolution ────────────────────────────────────────── */

  private resolveGeminiModel(modelId: string): string {
    const normalized = modelId.trim().toLowerCase();

    const modelMap: Record<string, string> = {
      "gemini-3.1-pro-preview-customtools": "gemini-2.5-pro",
      "gemini-3-flash-preview": "gemini-2.5-flash",
      "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
      "gemini-2.5-flash-preview-05-20": "gemini-2.5-flash",
    };

    return modelMap[normalized] ?? (normalized.startsWith("gemini-") ? normalized : "gemini-2.5-pro");
  }

  /* ─── Multi-Provider Dispatch ─────────────────────────────────── */

  /**
   * Checks token count and picks a lighter model from user config if prompt is too large.
   */
  private async getOptimalModel(client: any, intendedModel: string, promptText: string): Promise<string> {
    const lighterModel = this.getUserFallbackModel(intendedModel);
    try {
      const model = client.getGenerativeModel({ model: intendedModel });
      const { totalTokens } = await model.countTokens(promptText);
      if (totalTokens > 200_000 && lighterModel !== intendedModel) {
        console.log(`[AutoDev] Prompt masivo: ${totalTokens} tokens. Cambiando ${intendedModel} -> ${lighterModel}`);
        return this.resolveGeminiModel(lighterModel);
      }
      return intendedModel;
    } catch {
      const estimated = Math.ceil(promptText.length / 4);
      if (estimated > 200_000 && lighterModel !== intendedModel) {
        console.log(`[AutoDev] Prompt masivo (heuristica): ~${estimated} tokens. Cambiando ${intendedModel} -> ${lighterModel}`);
        return this.resolveGeminiModel(lighterModel);
      }
      return intendedModel;
    }
  }

  /**
   * Returns an alternative model from user config (different from the given one).
   * Uses the user's configured models — never hardcoded values.
   */
  private getUserFallbackModel(currentResolved: string): string {
    const models = this.snapshot.config.models;
    // Collect all unique user-configured Gemini models
    const candidates = new Set<string>();
    for (const role of ["research", "review", "planning", "coding"] as const) {
      const resolved = this.resolveGeminiModel(models[role]);
      if (resolved !== currentResolved) {
        candidates.add(models[role]);
      }
    }
    // Return the first different one, or the same if no alternative
    return candidates.values().next().value ?? currentResolved;
  }

  private isOverloadedError(err: any): boolean {
    const msg = err?.message ?? "";
    return msg.includes("503") || msg.includes("429")
      || msg.includes("Service Unavailable") || msg.includes("RESOURCE_EXHAUSTED")
      || msg.includes("fetch failed");
  }

  private async callGeminiDirect(modelId: string, prompt: string, jsonMode?: boolean): Promise<string> {
    const client = await this.ensureGeminiClient();
    let resolved = this.resolveGeminiModel(modelId);

    // Check token count — downgrade if prompt is too large
    resolved = await this.getOptimalModel(client, resolved, prompt);

    // Attempt with primary model
    try {
      return await this.executeGeminiCall(client, resolved, prompt, jsonMode);
    } catch (err: any) {
      if (!this.isOverloadedError(err)) throw err;

      // Get user's alternative model
      const fallback = this.resolveGeminiModel(this.getUserFallbackModel(resolved));

      // Cooldown 45s before fallback (let API quota reset)
      console.warn(`[AutoDev] Modelo ${resolved} sobrecargado. Enfriando API por 45s antes de usar ${fallback}...`);
      await new Promise((r) => setTimeout(r, 45_000));

      try {
        const result = await this.executeGeminiCall(client, fallback, prompt, jsonMode);
        console.log(`[AutoDev] Fallback exitoso con ${fallback}`);
        return result;
      } catch (fallbackErr: any) {
        if (!this.isOverloadedError(fallbackErr)) throw fallbackErr;

        // Both models overloaded — wait 30s more and retry original
        console.warn(`[AutoDev] Ambos modelos sobrecargados. Ultimo intento en 30s con ${resolved}...`);
        await new Promise((r) => setTimeout(r, 30_000));
        return this.executeGeminiCall(client, resolved, prompt, jsonMode);
      }
    }
  }

  private async executeGeminiCall(client: any, model: string, prompt: string, jsonMode?: boolean): Promise<string> {
    const config: any = { model };
    if (jsonMode) {
      config.generationConfig = { responseMimeType: "application/json" };
    }
    const geminiModel = client.getGenerativeModel(config);
    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
  }

  private async dispatchModelCall(modelId: string, prompt: string, jsonMode?: boolean): Promise<string> {
    const family = detectModelFamily(modelId);

    switch (family) {
      case "gemini":
        return this.callGeminiDirect(modelId, prompt, jsonMode);
      case "local":
        // Local models not yet supported - fallback to Gemini
        return this.callGeminiDirect("gemini-3-flash-preview", prompt, jsonMode);
    }
  }

  /* ─── High-level AI Prompt Methods ────────────────────────────── */

  private async generateTextPrompt(
    prompt: string,
    selectedModel: string,
  ): Promise<string> {
    return this.dispatchModelCall(selectedModel, prompt);
  }

  private async generateJsonPrompt<T>(
    prompt: string,
    selectedModel: string,
  ): Promise<T> {
    const firstText = await this.dispatchModelCall(selectedModel, prompt, true);
    const firstParsed = safeParseJson<T>(firstText);
    if (firstParsed) {
      return firstParsed;
    }

    // Retry with explicit JSON instruction
    const jsonHint = "\n\nResponde SOLO JSON valido, sin markdown ni explicacion adicional.";
    const retryPrompt = `${prompt}${jsonHint}`;
    const secondText = await this.dispatchModelCall(selectedModel, retryPrompt, true);
    const secondParsed = safeParseJson<T>(secondText);
    if (secondParsed) {
      return secondParsed;
    }

    throw new Error("La respuesta del modelo no fue JSON valido.");
  }

  private checkAbort(): void {
    if (this.abortController?.signal.aborted) {
      throw new AutodevAbortError();
    }
  }

  private loadConfig(): AutodevConfig {
    return mergeAutodevConfig(
      createAutodevRuntimeSnapshot().config,
      safeReadJson(CONFIG_PATH) ?? {},
    );
  }

  private saveConfig(): void {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify(this.snapshot.config, null, 2),
      "utf-8",
    );
  }

  private loadHistory(): AutodevHistoryEntry[] {
    const history = safeReadJson(HISTORY_PATH);
    if (!history || !Array.isArray(history.entries)) {
      return [];
    }
    return history.entries.filter(
      (entry): entry is AutodevHistoryEntry =>
        Boolean(entry) &&
        typeof entry.id === "string" &&
        typeof entry.status === "string" &&
        typeof entry.startedAt === "string" &&
        typeof entry.completedAt === "string",
    );
  }

  private saveHistory(): void {
    writeFileSync(
      HISTORY_PATH,
      JSON.stringify({ entries: this.history }, null, 2),
      "utf-8",
    );
  }

  private getMemoryPath(repoKey: string): string {
    return join(MEMORY_DIR, `${repoKey}.json`);
  }

  private loadRepoMemory(repoKey: string, repoLabel: string): RepoMemory {
    const currentPath = this.getMemoryPath(repoKey);
    const data = safeReadJson(currentPath);

    if (data) {
      return {
        repoKey,
        repoLabel:
          typeof data.repoLabel === "string" && data.repoLabel.trim()
            ? data.repoLabel
            : repoLabel,
        firstSeenAt:
          typeof data.firstSeenAt === "string" ? data.firstSeenAt : nowIso(),
        lastScannedAt:
          typeof data.lastScannedAt === "string" ? data.lastScannedAt : null,
        lastRunAt: typeof data.lastRunAt === "string" ? data.lastRunAt : null,
        indexedFiles: Array.isArray(data.indexedFiles)
          ? data.indexedFiles
              .filter(
                (file): file is { path: string; size: number; updatedAt: string } =>
                  Boolean(file) &&
                  typeof file.path === "string" &&
                  typeof file.size === "number" &&
                  typeof file.updatedAt === "string",
              )
              .slice(0, 500)
          : [],
        documents: Array.isArray(data.documents)
          ? data.documents
              .filter(
                (document): document is MemoryDocument =>
                  Boolean(document) &&
                  typeof document.path === "string" &&
                  typeof document.excerpt === "string" &&
                  typeof document.updatedAt === "string",
              )
              .slice(0, 50)
          : [],
        lessons: Array.isArray(data.lessons)
          ? data.lessons.filter((lesson): lesson is string => typeof lesson === "string").slice(0, 20)
          : [],
        recentRuns: Array.isArray(data.recentRuns)
          ? data.recentRuns
              .filter(
                (run): run is RepoMemory["recentRuns"][number] =>
                  Boolean(run) &&
                  typeof run.id === "string" &&
                  typeof run.status === "string" &&
                  typeof run.completedAt === "string" &&
                  typeof run.summary === "string",
              )
              .slice(0, 12)
          : [],
      };
    }

    return {
      repoKey,
      repoLabel,
      firstSeenAt: nowIso(),
      lastScannedAt: null,
      lastRunAt: null,
      indexedFiles: [],
      documents: [],
      lessons: [],
      recentRuns: [],
    };
  }

  private persistRepoMemory(
    execution: RuntimeExecution,
    status: "completed" | "failed" | "aborted",
    summary: string,
  ): void {
    const repoKey = repoKeyForContext(execution.context);
    const memory = execution.memory ?? this.loadRepoMemory(repoKey, execution.repoLabel);

    memory.repoLabel = execution.repoLabel;
    memory.lastRunAt = nowIso();
    memory.lastScannedAt = nowIso();
    memory.recentRuns = [
      {
        id: execution.runId,
        status,
        completedAt: nowIso(),
        summary,
      },
      ...memory.recentRuns,
    ].slice(0, 12);

    if (execution.scan) {
      memory.indexedFiles = execution.scan.files
        .slice(0, 500)
        .map((file) => ({
          path: file.path,
          size: file.size,
          updatedAt: file.updatedAt,
        }));
    }

    memory.documents = execution.documents.slice(0, 50).map((document) => ({
      path: document.path,
      excerpt: truncate(document.excerpt, 600),
      updatedAt: nowIso(),
    }));

    const lessons = new Set(memory.lessons);
    if (execution.review?.summary) {
      lessons.add(truncate(execution.review.summary, 220));
    }
    for (const warning of execution.warnings) {
      lessons.add(truncate(warning, 220));
    }
    memory.lessons = [...lessons].slice(0, 20);

    writeFileSync(
      this.getMemoryPath(repoKey),
      JSON.stringify(memory, null, 2),
      "utf-8",
    );
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.snapshot.history = snapshot.history;
    this.listener(snapshot);
  }

  private appendConsole(
    level: AutodevConsoleEntry["level"],
    title: string,
    content: string,
    command?: string,
  ): void {
    this.snapshot.state = {
      ...this.snapshot.state,
      console: [
        ...this.snapshot.state.console,
        {
          id: `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: nowIso(),
          level,
          title,
          content,
          command,
        },
      ].slice(-120),
      updatedAt: nowIso(),
    };
  }

  private upsertLiveFile(
    input: Omit<AutodevLiveFileActivity, "id" | "updatedAt"> & {
      updatedAt?: string;
    },
  ): void {
    const existing = this.snapshot.state.liveFiles.find((file) => file.path === input.path);
    const nextFile: AutodevLiveFileActivity = {
      id: existing?.id ?? `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      updatedAt: input.updatedAt ?? nowIso(),
      ...input,
    };

    const others = this.snapshot.state.liveFiles.filter((file) => file.path !== input.path);
    this.snapshot.state = {
      ...this.snapshot.state,
      liveFiles: [nextFile, ...others].slice(0, 24),
      updatedAt: nowIso(),
    };
    this.emit();
  }

  private ensureScheduler(): void {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    this.scheduleInterval = setInterval(() => {
      if (this.snapshot.state.running) {
        return;
      }

      const now = new Date();
      const matchingEntry = this.snapshot.config.scheduleEntries.find((entry) =>
        matchesScheduleEntry(entry, now),
      );

      if (!matchingEntry) {
        return;
      }

      const tickKey = `${matchingEntry.id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      if (this.lastScheduleTickKey === tickKey) {
        return;
      }

      this.lastScheduleTickKey = tickKey;
      void this.startRun({
        ...this.lastContext,
        triggerSource: "scheduled",
        scheduleLabel: matchingEntry.label,
      });
    }, 15_000);
  }
}

function cleanupFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore temp cleanup failures.
  }
}

function extractDependencyList(
  packageJson: Record<string, unknown> | null | undefined,
): string[] {
  if (!packageJson) {
    return [];
  }

  const sections = ["dependencies", "devDependencies"] as const;
  const values = new Set<string>();

  for (const section of sections) {
    const deps = packageJson[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const key of Object.keys(deps as Record<string, unknown>)) {
      values.add(key);
    }
  }

  return [...values];
}

function pickRelatedContext(
  scan: RepositoryScanResult,
  targetFile: string,
): RepoContextFile[] {
  const normalizedTarget = normalizePath(targetFile);
  const targetDir = dirname(normalizedTarget);
  const targetName = normalizedTarget.split("/").pop() ?? normalizedTarget;

  return [...scan.contextFiles]
    .sort((left, right) => {
      const leftScore =
        left.path === normalizedTarget
          ? 0
          : dirname(left.path) === targetDir
            ? 1
            : left.path.includes(targetName.replace(extname(targetName), ""))
              ? 2
              : left.priority + 3;
      const rightScore =
        right.path === normalizedTarget
          ? 0
          : dirname(right.path) === targetDir
            ? 1
            : right.path.includes(targetName.replace(extname(targetName), ""))
              ? 2
              : right.priority + 3;
      return leftScore - rightScore;
    })
    .slice(0, 6);
}

function cloneState(state: AutodevRuntimeSnapshot["state"]): AutodevRuntimeSnapshot["state"] {
  return {
    ...state,
    stages: state.stages.map((stage) => ({ ...stage })),
    console: state.console.map((entry) => ({ ...entry })),
    liveFiles: state.liveFiles.map((file) => ({ ...file })),
    report: state.report
      ? {
          ...state.report,
          selectedTools: [...state.report.selectedTools],
          documentsUsed: [...state.report.documentsUsed],
          researchQueries: [...state.report.researchQueries],
          validations: [...state.report.validations],
          warnings: [...state.report.warnings],
          files: state.report.files.map((file) => ({ ...file })),
          qaChecks: state.report.qaChecks.map((check) => ({ ...check })),
        }
      : null,
  };
}

function buildStartMessage(
  context: AutodevRunRequest,
  config: AutodevConfig,
): string {
  const source =
    context.localPath ||
    context.repoFullName ||
    context.repoUrl ||
    "repositorio sin fuente";
  const trigger =
    context.triggerSource === "scheduled"
      ? `Trigger programado (${context.scheduleLabel ?? "sin etiqueta"})`
      : "Trigger manual";

  return [
    trigger,
    `Fuente: ${source}`,
    `Rama: ${context.repoBranch ?? config.targetBranch}`,
    `Limites: ${config.maxFilesPerRun} archivos / ${config.maxLinesChanged} lineas`,
  ].join(" | ");
}

function cleanupImportPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const cleaned = normalized.replace(/\.(ts|tsx|js|jsx)$/i, "");
  return cleaned.startsWith(".") ? cleaned : `./${cleaned}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
