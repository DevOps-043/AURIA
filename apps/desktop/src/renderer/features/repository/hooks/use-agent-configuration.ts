import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AqelorFeasibilityCheck,
  AqelorPlanLimits,
  AqelorToolDefinition,
  AqelorToolExecution,
  AqelorToolUsageMonthly,
  AqelorWallet,
  AutonomousDocRecord,
  ModelCostPolicy,
  ModelDepth,
  ModelLatencyPolicy,
  ModelRoleKey,
  PlanCode,
  ToolPartialOutputType,
  WorkspaceMode,
} from "@auria/contracts";
import {
  evaluateToolFeasibility,
  getEffectiveSimultaneousAgents,
  getToolMonthlyLimit,
  type ToolFeasibilityResult,
} from "@auria/domain";
import { supabase } from "@/shared/api/supabase-client";
import { desktopBridge } from "@/shared/api/desktop-bridge";
import type { RepositoryPolicy } from "./use-repository-detail";

export interface AgentConfigurationPolicy extends RepositoryPolicy {
  allowedPaths: string[];
  blockedPaths: string[];
  criticalPaths: string[];
  blockedFileTypes: string[];
}

export interface ModelRouterProfile {
  roleKey: ModelRoleKey;
  primaryModel: string;
  fallbackModel: string;
  externalTools: boolean;
  depth: ModelDepth;
  parallelism: number;
  costPolicy: ModelCostPolicy;
  latencyPolicy: ModelLatencyPolicy;
}

export interface ToolCatalogEntry {
  definition: AqelorToolDefinition;
  usage: AqelorToolUsageMonthly | null;
  monthlyLimit: number | null;
  remainingRuns: number | null;
  feasibility: ToolFeasibilityResult;
}

export interface ToolExecutionActivity extends AqelorToolExecution {
  toolName: string;
  toolSlug: string;
}

export interface FeasibilityActivity extends AqelorFeasibilityCheck {
  toolName: string;
  toolSlug: string;
}

export interface AgentConfigurationSummary {
  planCode: PlanCode;
  subscriptionStatus: string;
  workspaceMode: WorkspaceMode;
  monthlyBudgetUsd: number;
  workspaceConcurrencyCap: number | null;
  repositoryConcurrencyCap: number | null;
  availableAgents: number;
  simultaneousAgents: number;
  effectiveSimultaneousAgents: number;
  premiumToolsEnabled: boolean;
  configurableModelRoles: string[];
  knowledgeDocuments: number;
  autonomousDocuments: number;
}

// ─── Schedule Entries ────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  enabled: boolean;
  hour: number;       // 0-23
  minute: number;     // 0-59
  days: string[];     // ['*'] = daily, or ['1','3','5'] (cron day-of-week)
  label: string;      // User-defined label (e.g. "Noche", "Madrugada")
}

export function generateScheduleId(): string {
  return `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DAYS_OF_WEEK = [
  { label: "L", cron: "1", name: "Lunes" },
  { label: "M", cron: "2", name: "Martes" },
  { label: "X", cron: "3", name: "Miercoles" },
  { label: "J", cron: "4", name: "Jueves" },
  { label: "V", cron: "5", name: "Viernes" },
  { label: "S", cron: "6", name: "Sabado" },
  { label: "D", cron: "0", name: "Domingo" },
] as const;

export const QUICK_TIMES = [
  { label: "12 AM", hour: 0 },
  { label: "3 AM", hour: 3 },
  { label: "6 AM", hour: 6 },
  { label: "9 AM", hour: 9 },
  { label: "12 PM", hour: 12 },
  { label: "3 PM", hour: 15 },
  { label: "6 PM", hour: 18 },
  { label: "9 PM", hour: 21 },
] as const;

export function formatTime12h(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export interface AutoDevLocalConfig {
  maxParallelAgents: number;
  targetBranch: string;
  workBranchPrefix: string;
  maxLinesChanged: number;
  maxFilesPerRun: number;
  scheduleEntries: ScheduleEntry[];
  models: {
    planning: string;
    coding: string;
    review: string;
    research: string;
  };
  enabledToolSlugs: Set<string>;
  toolAgents: Record<string, { assigned: number; simultaneous: number }>;
}

const DEFAULT_LOCAL_CONFIG: AutoDevLocalConfig = {
  maxParallelAgents: 1,
  targetBranch: "main",
  workBranchPrefix: "autodev/",
  maxLinesChanged: 2000,
  maxFilesPerRun: 30,
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
  enabledToolSlugs: new Set([
    "autonomous_docs",
    "quality",
    "improvement",
    "qa_correction",
    "security",
    "optimization",
    "spaghetti_cleanup",
    "new_implementation",
  ]),
  toolAgents: {},
};

export interface AgentConfigMutations {
  updateAgentCount: (count: number) => Promise<void>;
  updateTargetBranch: (branch: string) => Promise<void>;
  updateWorkBranchPrefix: (prefix: string) => Promise<void>;
  updateMaxLines: (maxLines: number) => Promise<void>;
  updateMaxFiles: (maxFiles: number) => Promise<void>;
  updateModel: (role: "planning" | "coding" | "review" | "research", model: string) => Promise<void>;
  toggleTool: (toolSlug: string, enabled: boolean) => Promise<void>;
  updateToolAgents: (toolSlug: string, assigned: number, simultaneous: number) => void;
  addScheduleEntry: () => void;
  removeScheduleEntry: (entryId: string) => void;
  updateScheduleEntry: (entryId: string, patch: Partial<ScheduleEntry>) => void;
  toggleScheduleEntryEnabled: (entryId: string) => void;
  toggleScheduleEntryDay: (entryId: string, day: string) => void;
}

interface AgentConfigurationState {
  summary: AgentConfigurationSummary;
  wallet: AqelorWallet;
  policy: AgentConfigurationPolicy | null;
  modelRouter: ModelRouterProfile[];
  tools: ToolCatalogEntry[];
  recentExecutions: ToolExecutionActivity[];
  recentChecks: FeasibilityActivity[];
  recentDocs: AutonomousDocRecord[];
  warnings: string[];
  loading: boolean;
  error: string | null;
  localConfig: AutoDevLocalConfig;
  saving: boolean;
  saveError: string | null;
  mutations: AgentConfigMutations;
}

interface UseAgentConfigurationArgs {
  repositoryId: string;
  workspaceId: string;
}

const DEFAULT_PLAN_LIMITS: Record<PlanCode, AqelorPlanLimits> = {
  free: {
    planCode: "free",
    maxAgentsAvailable: 5,
    maxAgentsSimultaneous: 1,
    maxRepositories: 1,
    maxLinesPerExecution: 200,
    maxFilesPerExecution: 10,
    maxDailyExecutions: 5,
    premiumToolsEnabled: false,
    maxResearchQueriesDaily: 5,
    maxDocsUploaded: 3,
    maxDocSizeBytes: 2_097_152,
    memoryRetentionDays: 15,
    byokEnabled: false,
    configurableModelRoles: [],
  },
  starter: {
    planCode: "starter",
    maxAgentsAvailable: 10,
    maxAgentsSimultaneous: 2,
    maxRepositories: 3,
    maxLinesPerExecution: 500,
    maxFilesPerExecution: 20,
    maxDailyExecutions: 20,
    premiumToolsEnabled: false,
    maxResearchQueriesDaily: 15,
    maxDocsUploaded: 10,
    maxDocSizeBytes: 5_242_880,
    memoryRetentionDays: 30,
    byokEnabled: false,
    configurableModelRoles: [],
  },
  pro: {
    planCode: "pro",
    maxAgentsAvailable: 15,
    maxAgentsSimultaneous: 5,
    maxRepositories: 10,
    maxLinesPerExecution: 1000,
    maxFilesPerExecution: 50,
    maxDailyExecutions: 50,
    premiumToolsEnabled: true,
    maxResearchQueriesDaily: 50,
    maxDocsUploaded: 50,
    maxDocSizeBytes: 10_485_760,
    memoryRetentionDays: 90,
    byokEnabled: true,
    configurableModelRoles: ["planning", "implementation", "review", "qa"],
  },
  enterprise: {
    planCode: "enterprise",
    maxAgentsAvailable: 15,
    maxAgentsSimultaneous: 10,
    maxRepositories: 50,
    maxLinesPerExecution: 2000,
    maxFilesPerExecution: 100,
    maxDailyExecutions: 200,
    premiumToolsEnabled: true,
    maxResearchQueriesDaily: 200,
    maxDocsUploaded: 200,
    maxDocSizeBytes: 52_428_800,
    memoryRetentionDays: 365,
    byokEnabled: true,
    configurableModelRoles: [
      "planning",
      "implementation",
      "research",
      "review",
      "qa",
      "risk",
      "memory",
    ],
  },
};

const DEFAULT_TOOLS: AqelorToolDefinition[] = [
  createDefaultTool({
    id: "knowledge_intake",
    slug: "knowledge_intake",
    name: "Carga de conocimiento",
    description: "Incorpora documentos tecnicos y de producto existentes como contexto del repositorio.",
    category: "knowledge",
    costMinimumMicro: 500,
    costStandardMicro: 1000,
    costFullMicro: 2000,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "low",
    maxAgentsRequired: 1,
    defaultModelTier: "lite",
    minPlanRequired: "free",
    sortOrder: 1,
  }),
  createDefaultTool({
    id: "autonomous_docs",
    slug: "autonomous_docs",
    name: "Documentacion autonoma",
    description: "Genera notas de commit, resumenes de PR, changelogs y documentos de entrega a partir de cambios reales del repositorio.",
    category: "documentation",
    costMinimumMicro: 300,
    costStandardMicro: 800,
    costFullMicro: 1500,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "low",
    maxAgentsRequired: 1,
    defaultModelTier: "lite",
    minPlanRequired: "free",
    sortOrder: 2,
  }),
  createDefaultTool({
    id: "research",
    slug: "research",
    name: "Investigacion / busqueda / contexto URL",
    description: "Ejecuta investigacion web y analisis contextual de URLs para decisiones tecnicas e innovacion.",
    category: "research",
    costMinimumMicro: 200,
    costStandardMicro: 600,
    costFullMicro: 1200,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "low",
    maxAgentsRequired: 1,
    defaultModelTier: "standard",
    minPlanRequired: "free",
    sortOrder: 3,
  }),
  createDefaultTool({
    id: "quality",
    slug: "quality",
    name: "Calidad",
    description: "Aplica limpieza de nivel lint, revisiones de consistencia y mejoras de calidad de bajo riesgo.",
    category: "quality",
    costMinimumMicro: 200,
    costStandardMicro: 500,
    costFullMicro: 1000,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "low",
    maxAgentsRequired: 1,
    defaultModelTier: "lite",
    minPlanRequired: "free",
    sortOrder: 4,
  }),
  createDefaultTool({
    id: "improvement",
    slug: "improvement",
    name: "Mejora tecnica",
    description: "Reduce deuda tecnica moderada con refactors acotados y limpieza estructural.",
    category: "improvement",
    costMinimumMicro: 400,
    costStandardMicro: 1000,
    costFullMicro: 2000,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "moderate",
    maxAgentsRequired: 2,
    defaultModelTier: "standard",
    minPlanRequired: "starter",
    sortOrder: 5,
  }),
  createDefaultTool({
    id: "qa_correction",
    slug: "qa_correction",
    name: "Correccion QA",
    description: "Corrige bugs reproducibles, problemas de flujo y validaciones invalidas detectadas por QA.",
    category: "qa_correction",
    costMinimumMicro: 300,
    costStandardMicro: 800,
    costFullMicro: 1500,
    allowsPartial: true,
    partialOutputType: "reduced_scope",
    isPremium: false,
    riskLevel: "moderate",
    maxAgentsRequired: 1,
    defaultModelTier: "standard",
    minPlanRequired: "free",
    sortOrder: 6,
  }),
  createDefaultTool({
    id: "security",
    slug: "security",
    name: "Seguridad",
    description: "Analiza y corrige riesgos de seguridad, secretos expuestos y debilidades de validacion.",
    category: "security",
    costMinimumMicro: 500,
    costStandardMicro: 1200,
    costFullMicro: 2500,
    allowsPartial: true,
    partialOutputType: "analysis_only",
    isPremium: false,
    riskLevel: "high",
    maxAgentsRequired: 2,
    defaultModelTier: "standard",
    minPlanRequired: "starter",
    sortOrder: 7,
  }),
  createDefaultTool({
    id: "optimization",
    slug: "optimization",
    name: "Optimizacion",
    description: "Mejora rendimiento, rutas pesadas y flujos ineficientes con un alcance diagnostico seguro.",
    category: "optimization",
    costMinimumMicro: 400,
    costStandardMicro: 1000,
    costFullMicro: 2000,
    allowsPartial: true,
    partialOutputType: "diagnostic_only",
    isPremium: false,
    riskLevel: "moderate",
    maxAgentsRequired: 2,
    defaultModelTier: "standard",
    minPlanRequired: "starter",
    sortOrder: 8,
  }),
  createDefaultTool({
    id: "spaghetti_cleanup",
    slug: "spaghetti_cleanup",
    name: "Limpieza profunda",
    description: "Ejecuta refactors premium profundos sobre zonas de codigo fragiles o muy acopladas.",
    category: "spaghetti_cleanup",
    costMinimumMicro: 1000,
    costStandardMicro: 3000,
    costFullMicro: 6000,
    allowsPartial: false,
    partialOutputType: null,
    isPremium: true,
    riskLevel: "critical",
    maxAgentsRequired: 3,
    defaultModelTier: "pro",
    minPlanRequired: "pro",
    sortOrder: 9,
  }),
  createDefaultTool({
    id: "new_implementation",
    slug: "new_implementation",
    name: "Nueva implementacion",
    description: "Construye nuevas capacidades con un modo parcial limitado a analisis, diseno y planes.",
    category: "implementation",
    costMinimumMicro: 800,
    costStandardMicro: 2500,
    costFullMicro: 5000,
    allowsPartial: true,
    partialOutputType: "plan_only",
    isPremium: true,
    riskLevel: "high",
    maxAgentsRequired: 3,
    defaultModelTier: "pro",
    minPlanRequired: "starter",
    sortOrder: 10,
  }),
];

const NOOP_MUTATIONS: AgentConfigMutations = {
  updateAgentCount: async () => {},
  updateTargetBranch: async () => {},
  updateWorkBranchPrefix: async () => {},
  updateMaxLines: async () => {},
  updateMaxFiles: async () => {},
  updateModel: async () => {},
  toggleTool: async () => {},
  updateToolAgents: () => {},
  addScheduleEntry: () => {},
  removeScheduleEntry: () => {},
  updateScheduleEntry: () => {},
  toggleScheduleEntryEnabled: () => {},
  toggleScheduleEntryDay: () => {},
};

const INITIAL_STATE: AgentConfigurationState = {
  summary: {
    planCode: "free",
    subscriptionStatus: "unknown",
    workspaceMode: "local",
    monthlyBudgetUsd: 0,
    workspaceConcurrencyCap: null,
    repositoryConcurrencyCap: null,
    availableAgents: DEFAULT_PLAN_LIMITS.free.maxAgentsAvailable,
    simultaneousAgents: DEFAULT_PLAN_LIMITS.free.maxAgentsSimultaneous,
    effectiveSimultaneousAgents: DEFAULT_PLAN_LIMITS.free.maxAgentsSimultaneous,
    premiumToolsEnabled: DEFAULT_PLAN_LIMITS.free.premiumToolsEnabled,
    configurableModelRoles: DEFAULT_PLAN_LIMITS.free.configurableModelRoles,
    knowledgeDocuments: 0,
    autonomousDocuments: 0,
  },
  wallet: {
    id: "wallet-unavailable",
    workspaceId: "workspace-unavailable",
    balanceMicro: 0,
    reservedMicro: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    lifetimeRefund: 0,
  },
  policy: null,
  modelRouter: [],
  tools: [],
  recentExecutions: [],
  recentChecks: [],
  recentDocs: [],
  warnings: [],
  loading: true,
  error: null,
  localConfig: { ...DEFAULT_LOCAL_CONFIG, enabledToolSlugs: new Set(DEFAULT_LOCAL_CONFIG.enabledToolSlugs) },
  saving: false,
  saveError: null,
  mutations: NOOP_MUTATIONS,
};

function parseAutoDevConfig(raw: Record<string, unknown>): Partial<AutoDevLocalConfig> {
  const result: Partial<AutoDevLocalConfig> = {};
  if (typeof raw.maxParallelAgents === "number") result.maxParallelAgents = raw.maxParallelAgents;
  if (typeof raw.targetBranch === "string") result.targetBranch = raw.targetBranch;
  if (typeof raw.workBranchPrefix === "string") result.workBranchPrefix = raw.workBranchPrefix;
  if (typeof raw.maxLinesChanged === "number") result.maxLinesChanged = raw.maxLinesChanged;
  if (typeof raw.maxFilesPerRun === "number") result.maxFilesPerRun = raw.maxFilesPerRun;

  if (Array.isArray(raw.scheduleEntries)) {
    result.scheduleEntries = (raw.scheduleEntries as unknown[]).filter(
      (e): e is ScheduleEntry =>
        typeof e === "object" && e !== null && "id" in e && "hour" in e,
    );
  }

  const agents = raw.agents as Record<string, { model?: string }> | undefined;
  if (agents) {
    result.models = {
      planning: agents.coder?.model ?? DEFAULT_LOCAL_CONFIG.models.planning,
      coding: agents.coder?.model ?? DEFAULT_LOCAL_CONFIG.models.coding,
      review: agents.reviewer?.model ?? DEFAULT_LOCAL_CONFIG.models.review,
      research: agents.researcher?.model ?? DEFAULT_LOCAL_CONFIG.models.research,
    };
  }

  return result;
}

export function useAgentConfiguration({
  repositoryId,
  workspaceId,
}: UseAgentConfigurationArgs): AgentConfigurationState {
  const [state, setState] = useState<AgentConfigurationState>(INITIAL_STATE);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!repositoryId || !workspaceId || !supabase) {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Falta el contexto del repositorio o del espacio de trabajo.",
      }));
      return;
    }

    const client = supabase;
    let cancelled = false;

    const load = async () => {
      const warnings: string[] = [];

      try {
        setState((current) => ({ ...current, loading: true, error: null }));

        const workspaceResult = await client
          .from("workspaces")
          .select("id, mode, max_concurrent_agents, subscription_id")
          .eq("id", workspaceId)
          .maybeSingle();

        if (workspaceResult.error) {
          throw workspaceResult.error;
        }

        if (!workspaceResult.data) {
          throw new Error("No se encontro el espacio de trabajo.");
        }

        const subscriptionResult = workspaceResult.data.subscription_id
          ? await client
              .from("subscriptions")
              .select("plan_code, status, budget_limit_usd")
              .eq("id", workspaceResult.data.subscription_id)
              .maybeSingle()
          : { data: null, error: null };

        if (subscriptionResult.error) {
          warnings.push(`Los datos de suscripcion no estan disponibles: ${subscriptionResult.error.message}`);
        }

        const planCode = normalizePlanCode(subscriptionResult.data?.plan_code);
        const defaultPlan = DEFAULT_PLAN_LIMITS[planCode];
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const [
          policyResult,
          pathsResult,
          blockedTypesResult,
          modelRouterResult,
          walletResult,
          planLimitsResult,
          toolsResult,
          usageResult,
          executionsResult,
          checksResult,
          docsResult,
          uploadedDocsResult,
        ] = await Promise.all([
          client
            .from("repository_policies")
            .select("*")
            .eq("repository_id", repositoryId)
            .maybeSingle(),
          client
            .from("repository_paths")
            .select("path, path_type")
            .eq("repository_id", repositoryId),
          client
            .from("repository_blocked_file_types")
            .select("extension")
            .eq("repository_id", repositoryId),
          client
            .from("model_router_configs")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("role_key", { ascending: true }),
          client
            .from("au_wallets")
            .select("*")
            .eq("workspace_id", workspaceId)
            .maybeSingle(),
          client
            .from("plan_limits")
            .select("*")
            .eq("plan_code", planCode)
            .maybeSingle(),
          client
            .from("tool_definitions")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          client
            .from("tool_usage_monthly")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("period_year", currentYear)
            .eq("period_month", currentMonth),
          client
            .from("tool_executions")
            .select(
              "id, tool_definition_id, execution_mode, model_used, model_tier, status, failure_origin, error_message, au_reserved_micro, au_consumed_micro, au_refunded_micro, lines_changed, files_touched, started_at, completed_at, created_at, tool_definitions(name, slug)",
            )
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(6),
          client
            .from("feasibility_checks")
            .select(
              "id, tool_definition_id, au_available_micro, cost_minimum_micro, cost_standard_micro, cost_full_micro, verdict, reason, partial_scope, risk_assessment, lines_estimated, files_estimated, agents_required, agents_available, approved, created_at, tool_definitions(name, slug)",
            )
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(6),
          client
            .from("autonomous_docs")
            .select("id, doc_type, title, created_at", { count: "exact" })
            .eq("repository_id", repositoryId)
            .order("created_at", { ascending: false })
            .limit(4),
          client
            .from("uploaded_documents")
            .select("id", { count: "exact", head: true })
            .eq("repository_id", repositoryId),
        ]);

        collectWarning(warnings, "Politica del repositorio", policyResult.error);
        collectWarning(warnings, "Rutas del repositorio", pathsResult.error);
        collectWarning(warnings, "Tipos de archivo bloqueados", blockedTypesResult.error);
        collectWarning(warnings, "Router de modelos", modelRouterResult.error);
        collectWarning(warnings, "Billetera AU", walletResult.error);
        collectWarning(warnings, "Limites del plan", planLimitsResult.error);
        collectWarning(warnings, "Catalogo de herramientas", toolsResult.error);
        collectWarning(warnings, "Uso mensual de herramientas", usageResult.error);
        collectWarning(warnings, "Ejecuciones de herramientas", executionsResult.error);
        collectWarning(warnings, "Comprobaciones de viabilidad", checksResult.error);
        collectWarning(warnings, "Documentos autonomos", docsResult.error);
        collectWarning(warnings, "Documentos cargados", uploadedDocsResult.error);

        const wallet = walletResult.data
          ? mapWallet(walletResult.data)
          : {
              ...INITIAL_STATE.wallet,
              workspaceId,
            };
        const planLimits = planLimitsResult.data
          ? mapPlanLimits(planLimitsResult.data)
          : defaultPlan;
        const policy = policyResult.data
          ? mapPolicy(
              policyResult.data,
              pathsResult.data ?? [],
              blockedTypesResult.data ?? [],
            )
          : null;
        const modelRouter = (modelRouterResult.data ?? []).map(mapModelRouter);
        const toolDefinitions = (toolsResult.data ?? []).length > 0
          ? (toolsResult.data ?? []).map(mapToolDefinition)
          : DEFAULT_TOOLS;
        const toolUsage = (usageResult.data ?? []).map(mapToolUsageMonthly);
        const usageByToolId = new Map(
          toolUsage.map((usage) => [usage.toolDefinitionId, usage]),
        );
        const effectiveSimultaneousAgents = getEffectiveSimultaneousAgents(
          planLimits,
          policy?.maxConcurrentAgents ?? null,
          workspaceResult.data.max_concurrent_agents ?? null,
        );
        const toolEntries = toolDefinitions.map((definition) => {
          const usage = usageByToolId.get(definition.id) ?? null;
          const monthlyLimit = getToolMonthlyLimit(definition, planCode);
          const remainingRuns =
            monthlyLimit === null
              ? null
              : Math.max(monthlyLimit - (usage?.executionCount ?? 0), 0);

          return {
            definition,
            usage,
            monthlyLimit,
            remainingRuns,
            feasibility: evaluateToolFeasibility({
              availableMicro: Math.max(wallet.balanceMicro - wallet.reservedMicro, 0),
              tool: definition,
              planCode,
              simultaneousAgents: effectiveSimultaneousAgents,
              premiumToolsEnabled: planLimits.premiumToolsEnabled,
            }),
          };
        });
        const toolNameById = new Map(
          toolDefinitions.map((definition) => [
            definition.id,
            { name: definition.name, slug: definition.slug },
          ]),
        );
        const recentExecutions = (executionsResult.data ?? []).map((row) =>
          mapToolExecution(row, toolNameById),
        );
        const recentChecks = (checksResult.data ?? []).map((row) =>
          mapFeasibilityCheck(row, toolNameById),
        );
        const recentDocs = (docsResult.data ?? []).map(mapAutonomousDoc);

        let localConfig: AutoDevLocalConfig = {
          ...DEFAULT_LOCAL_CONFIG,
          enabledToolSlugs: new Set(DEFAULT_LOCAL_CONFIG.enabledToolSlugs),
        };
        try {
          const rawConfig = await desktopBridge.autodevGetConfig();
          if (rawConfig && typeof rawConfig === "object" && Object.keys(rawConfig).length > 0) {
            const parsed = parseAutoDevConfig(rawConfig);
            localConfig = { ...localConfig, ...parsed };
          }
        } catch {
          warnings.push("No se pudo obtener la configuracion del worker local.");
        }

        if (!cancelled) {
          setState((prev) => ({
            summary: {
              planCode,
              subscriptionStatus: subscriptionResult.data?.status ?? "trialing",
              workspaceMode: normalizeWorkspaceMode(workspaceResult.data.mode),
              monthlyBudgetUsd: toNumber(subscriptionResult.data?.budget_limit_usd),
              workspaceConcurrencyCap: toNullableNumber(
                workspaceResult.data.max_concurrent_agents,
              ),
              repositoryConcurrencyCap: policy?.maxConcurrentAgents ?? null,
              availableAgents: planLimits.maxAgentsAvailable,
              simultaneousAgents: planLimits.maxAgentsSimultaneous,
              effectiveSimultaneousAgents,
              premiumToolsEnabled: planLimits.premiumToolsEnabled,
              configurableModelRoles: planLimits.configurableModelRoles,
              knowledgeDocuments: uploadedDocsResult.count ?? 0,
              autonomousDocuments: docsResult.count ?? recentDocs.length,
            },
            wallet,
            policy,
            modelRouter,
            tools: toolEntries,
            recentExecutions,
            recentChecks,
            recentDocs,
            warnings,
            loading: false,
            error: null,
            localConfig,
            saving: false,
            saveError: null,
            mutations: prev.mutations,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "No se pudo cargar la configuracion de agentes.",
          }));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [repositoryId, workspaceId]);

  const pushToWorker = useCallback(async (updates: Record<string, unknown>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setState((prev) => ({ ...prev, saving: true, saveError: null }));
    try {
      await desktopBridge.autodevUpdateConfig(updates);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        saveError: err instanceof Error ? err.message : "Error al guardar la configuracion.",
      }));
    } finally {
      savingRef.current = false;
      setState((prev) => ({ ...prev, saving: false }));
    }
  }, []);

  const updateAgentCount = useCallback(async (count: number) => {
    setState((prev) => ({
      ...prev,
      localConfig: { ...prev.localConfig, maxParallelAgents: count },
    }));
    await pushToWorker({ maxParallelAgents: count });
  }, [pushToWorker]);

  const updateTargetBranch = useCallback(async (branch: string) => {
    setState((prev) => ({
      ...prev,
      localConfig: { ...prev.localConfig, targetBranch: branch },
    }));
    await pushToWorker({ targetBranch: branch });
  }, [pushToWorker]);

  const updateMaxLines = useCallback(async (maxLines: number) => {
    setState((prev) => ({
      ...prev,
      localConfig: { ...prev.localConfig, maxLinesChanged: maxLines },
    }));
    await pushToWorker({ maxLinesChanged: maxLines });
    if (supabase && repositoryId) {
      await supabase
        .from("repository_policies")
        .update({ max_lines_per_mission: maxLines })
        .eq("repository_id", repositoryId);
    }
  }, [pushToWorker, repositoryId]);

  const updateMaxFiles = useCallback(async (maxFiles: number) => {
    setState((prev) => ({
      ...prev,
      localConfig: { ...prev.localConfig, maxFilesPerRun: maxFiles },
    }));
    await pushToWorker({ maxFilesPerRun: maxFiles });
    if (supabase && repositoryId) {
      await supabase
        .from("repository_policies")
        .update({ max_files_touched: maxFiles })
        .eq("repository_id", repositoryId);
    }
  }, [pushToWorker, repositoryId]);

  const updateWorkBranchPrefix = useCallback(async (prefix: string) => {
    setState((prev) => ({
      ...prev,
      localConfig: { ...prev.localConfig, workBranchPrefix: prefix },
    }));
    await pushToWorker({ workBranchPrefix: prefix });
  }, [pushToWorker]);

  const updateModel = useCallback(async (role: "planning" | "coding" | "review" | "research", model: string) => {
    setState((prev) => ({
      ...prev,
      localConfig: {
        ...prev.localConfig,
        models: { ...prev.localConfig.models, [role]: model },
      },
    }));

    const agentKeyMap: Record<string, string> = {
      planning: "coder",
      coding: "coder",
      review: "reviewer",
      research: "researcher",
    };
    const agentKey = agentKeyMap[role];
    await pushToWorker({
      agents: { [agentKey]: { model } },
    });

    if (supabase && workspaceId) {
      const roleKeyMap: Record<string, string> = {
        planning: "planning",
        coding: "implementation",
        review: "review",
        research: "research",
      };
      await supabase
        .from("model_router_configs")
        .upsert(
          { workspace_id: workspaceId, role_key: roleKeyMap[role], primary_model: model },
          { onConflict: "workspace_id,role_key" },
        );
    }
  }, [pushToWorker, workspaceId]);

  const toggleTool = useCallback(async (toolSlug: string, enabled: boolean) => {
    setState((prev) => {
      const next = new Set(prev.localConfig.enabledToolSlugs);
      if (enabled) next.add(toolSlug);
      else next.delete(toolSlug);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, enabledToolSlugs: next },
      };
    });
  }, []);

  const updateToolAgents = useCallback((toolSlug: string, assigned: number, simultaneous: number) => {
    setState((prev) => ({
      ...prev,
      localConfig: {
        ...prev.localConfig,
        toolAgents: {
          ...prev.localConfig.toolAgents,
          [toolSlug]: { assigned, simultaneous },
        },
      },
    }));
  }, []);

  // ─── Schedule entry mutations ──────────────────────────────────

  const persistScheduleEntries = useCallback((entries: ScheduleEntry[]) => {
    void pushToWorker({ scheduleEntries: entries });
  }, [pushToWorker]);

  const addScheduleEntry = useCallback(() => {
    setState((prev) => {
      const newEntry: ScheduleEntry = {
        id: generateScheduleId(),
        enabled: true,
        hour: 9,
        minute: 0,
        days: ["*"],
        label: "",
      };
      const updated = [...prev.localConfig.scheduleEntries, newEntry];
      persistScheduleEntries(updated);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, scheduleEntries: updated },
      };
    });
  }, [persistScheduleEntries]);

  const removeScheduleEntry = useCallback((entryId: string) => {
    setState((prev) => {
      const updated = prev.localConfig.scheduleEntries.filter((e) => e.id !== entryId);
      persistScheduleEntries(updated);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, scheduleEntries: updated },
      };
    });
  }, [persistScheduleEntries]);

  const updateScheduleEntry = useCallback((entryId: string, patch: Partial<ScheduleEntry>) => {
    setState((prev) => {
      const updated = prev.localConfig.scheduleEntries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      );
      persistScheduleEntries(updated);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, scheduleEntries: updated },
      };
    });
  }, [persistScheduleEntries]);

  const toggleScheduleEntryEnabled = useCallback((entryId: string) => {
    setState((prev) => {
      const updated = prev.localConfig.scheduleEntries.map((e) =>
        e.id === entryId ? { ...e, enabled: !e.enabled } : e,
      );
      persistScheduleEntries(updated);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, scheduleEntries: updated },
      };
    });
  }, [persistScheduleEntries]);

  const toggleScheduleEntryDay = useCallback((entryId: string, day: string) => {
    setState((prev) => {
      const updated = prev.localConfig.scheduleEntries.map((e) => {
        if (e.id !== entryId) return e;
        let newDays: string[];
        if (day === "*") {
          newDays = ["*"];
        } else {
          const current = e.days.filter((d) => d !== "*");
          if (current.includes(day)) {
            newDays = current.filter((d) => d !== day);
            if (newDays.length === 0) newDays = ["*"];
          } else {
            newDays = [...current, day];
            if (newDays.length === 7) newDays = ["*"];
          }
        }
        return { ...e, days: newDays };
      });
      persistScheduleEntries(updated);
      return {
        ...prev,
        localConfig: { ...prev.localConfig, scheduleEntries: updated },
      };
    });
  }, [persistScheduleEntries]);

  const mutations: AgentConfigMutations = {
    updateAgentCount,
    updateTargetBranch,
    updateWorkBranchPrefix,
    updateMaxLines,
    updateMaxFiles,
    updateModel,
    toggleTool,
    updateToolAgents,
    addScheduleEntry,
    removeScheduleEntry,
    updateScheduleEntry,
    toggleScheduleEntryEnabled,
    toggleScheduleEntryDay,
  };

  return { ...state, mutations };
}

function createDefaultTool(
  tool: Omit<
    AqelorToolDefinition,
    | "maxLinesPerExecution"
    | "maxFilesPerExecution"
    | "monthlyLimitFree"
    | "monthlyLimitStarter"
    | "monthlyLimitPro"
    | "isActive"
  > & {
    partialOutputType: ToolPartialOutputType | null;
  },
): AqelorToolDefinition {
  return {
    ...tool,
    maxLinesPerExecution: null,
    maxFilesPerExecution: null,
    monthlyLimitFree: null,
    monthlyLimitStarter: null,
    monthlyLimitPro: null,
    isActive: true,
  };
}

function collectWarning(
  warnings: string[],
  label: string,
  error: { message?: string } | null,
): void {
  if (error?.message) {
    warnings.push(`${label} no disponible: ${error.message}`);
  }
}

function normalizePlanCode(value: unknown): PlanCode {
  return value === "starter" || value === "pro" || value === "enterprise"
    ? value
    : "free";
}

function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "cloud" || value === "hybrid" ? value : "local";
}

function mapPolicy(
  row: any,
  paths: Array<{ path: string; path_type: string }>,
  blockedTypes: Array<{ extension: string }>,
): AgentConfigurationPolicy {
  return {
    autonomyMode: row.autonomy_mode,
    humanReviewAbove: row.require_human_review_above,
    maxLinesMission: toNumber(row.max_lines_per_mission),
    maxLinesFile: toNumber(row.max_lines_per_file),
    maxFilesTouched: toNumber(row.max_files_touched),
    maxConcurrentAgents: toNumber(row.max_concurrent_agents),
    allowedPaths: paths
      .filter((entry) => entry.path_type === "allowed")
      .map((entry) => entry.path),
    blockedPaths: paths
      .filter((entry) => entry.path_type === "blocked")
      .map((entry) => entry.path),
    criticalPaths: paths
      .filter((entry) => entry.path_type === "critical")
      .map((entry) => entry.path),
    blockedFileTypes: blockedTypes.map((entry) => entry.extension),
  };
}

function mapModelRouter(row: any): ModelRouterProfile {
  return {
    roleKey: row.role_key,
    primaryModel: row.primary_model,
    fallbackModel: row.fallback_model,
    externalTools: Boolean(row.external_tools),
    depth: row.depth,
    parallelism: toNumber(row.parallelism),
    costPolicy: row.cost_policy,
    latencyPolicy: row.latency_policy,
  };
}

function mapWallet(row: any): AqelorWallet {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    balanceMicro: toNumber(row.balance_micro),
    reservedMicro: toNumber(row.reserved_micro),
    lifetimeEarned: toNumber(row.lifetime_earned),
    lifetimeSpent: toNumber(row.lifetime_spent),
    lifetimeRefund: toNumber(row.lifetime_refund),
  };
}

function mapPlanLimits(row: any): AqelorPlanLimits {
  return {
    planCode: normalizePlanCode(row.plan_code),
    maxAgentsAvailable: toNumber(row.max_agents_available),
    maxAgentsSimultaneous: toNumber(row.max_agents_simultaneous),
    maxRepositories: toNumber(row.max_repositories),
    maxLinesPerExecution: toNumber(row.max_lines_per_execution),
    maxFilesPerExecution: toNumber(row.max_files_per_execution),
    maxDailyExecutions: toNumber(row.max_daily_executions),
    premiumToolsEnabled: Boolean(row.premium_tools_enabled),
    maxResearchQueriesDaily: toNumber(row.max_research_queries_daily),
    maxDocsUploaded: toNumber(row.max_docs_uploaded),
    maxDocSizeBytes: toNumber(row.max_doc_size_bytes),
    memoryRetentionDays: toNumber(row.memory_retention_days),
    byokEnabled: Boolean(row.byok_enabled),
    configurableModelRoles: Array.isArray(row.configurable_model_roles)
      ? row.configurable_model_roles
      : [],
  };
}

function mapToolDefinition(row: any): AqelorToolDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    costMinimumMicro: toNumber(row.cost_minimum_micro),
    costStandardMicro: toNumber(row.cost_standard_micro),
    costFullMicro: toNumber(row.cost_full_micro),
    allowsPartial: Boolean(row.allows_partial),
    partialOutputType: row.partial_output_type ?? null,
    isPremium: Boolean(row.is_premium),
    riskLevel: row.risk_level,
    maxLinesPerExecution: toNullableNumber(row.max_lines_per_execution),
    maxFilesPerExecution: toNullableNumber(row.max_files_per_execution),
    maxAgentsRequired: toNumber(row.max_agents_required),
    defaultModelTier: row.default_model_tier,
    minPlanRequired: normalizePlanCode(row.min_plan_required),
    monthlyLimitFree: toNullableNumber(row.monthly_limit_free),
    monthlyLimitStarter: toNullableNumber(row.monthly_limit_starter),
    monthlyLimitPro: toNullableNumber(row.monthly_limit_pro),
    isActive: row.is_active !== false,
    sortOrder: toNumber(row.sort_order),
  };
}

function mapToolUsageMonthly(row: any): AqelorToolUsageMonthly {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    toolDefinitionId: row.tool_definition_id,
    periodYear: toNumber(row.period_year),
    periodMonth: toNumber(row.period_month),
    executionCount: toNumber(row.execution_count),
    auConsumedMicro: toNumber(row.au_consumed_micro),
    tokensUsed: toNumber(row.tokens_used),
  };
}

function mapToolExecution(
  row: any,
  names: Map<string, { name: string; slug: string }>,
): ToolExecutionActivity {
  const relatedTool = extractRelatedTool(row.tool_definitions);
  const fallback = names.get(row.tool_definition_id);

  return {
    id: row.id,
    toolDefinitionId: row.tool_definition_id,
    executionMode: row.execution_mode,
    modelUsed: row.model_used,
    modelTier: row.model_tier,
    status: row.status,
    failureOrigin: row.failure_origin ?? null,
    errorMessage: row.error_message ?? null,
    auReservedMicro: toNumber(row.au_reserved_micro),
    auConsumedMicro: toNumber(row.au_consumed_micro),
    auRefundedMicro: toNumber(row.au_refunded_micro),
    linesChanged: toNumber(row.lines_changed),
    filesTouched: toNumber(row.files_touched),
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    toolName: relatedTool?.name ?? fallback?.name ?? "Herramienta desconocida",
    toolSlug: relatedTool?.slug ?? fallback?.slug ?? "unknown_tool",
  };
}

function mapFeasibilityCheck(
  row: any,
  names: Map<string, { name: string; slug: string }>,
): FeasibilityActivity {
  const relatedTool = extractRelatedTool(row.tool_definitions);
  const fallback = names.get(row.tool_definition_id);

  return {
    id: row.id,
    toolDefinitionId: row.tool_definition_id,
    auAvailableMicro: toNumber(row.au_available_micro),
    costMinimumMicro: toNumber(row.cost_minimum_micro),
    costStandardMicro: toNumber(row.cost_standard_micro),
    costFullMicro: toNumber(row.cost_full_micro),
    verdict: row.verdict,
    reason: row.reason ?? "",
    partialScope: row.partial_scope ?? null,
    riskAssessment: row.risk_assessment ?? null,
    linesEstimated: toNumber(row.lines_estimated),
    filesEstimated: toNumber(row.files_estimated),
    agentsRequired: toNumber(row.agents_required),
    agentsAvailable: toNumber(row.agents_available),
    approved: Boolean(row.approved),
    createdAt: row.created_at,
    toolName: relatedTool?.name ?? fallback?.name ?? "Herramienta desconocida",
    toolSlug: relatedTool?.slug ?? fallback?.slug ?? "unknown_tool",
  };
}

function mapAutonomousDoc(row: any): AutonomousDocRecord {
  return {
    id: row.id,
    docType: row.doc_type,
    title: row.title,
    createdAt: row.created_at,
  };
}

function extractRelatedTool(
  relation: { name?: string; slug?: string } | Array<{ name?: string; slug?: string }> | null,
): { name?: string; slug?: string } | null {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
}
