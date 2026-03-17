import { z } from "zod";

export const objectiveKeys = [
  "quality",
  "security",
  "technicalDebt",
  "dependencies",
  "coverage",
  "documentation",
  "performance",
  "innovation",
  "research",
] as const;

export type ObjectiveKey = (typeof objectiveKeys)[number];

export const modelRoleKeys = [
  "planning",
  "implementation",
  "research",
  "review",
  "risk",
  "memory",
] as const;

export type ModelRoleKey = (typeof modelRoleKeys)[number];

export const missionStatusOrder = [
  "discovered",
  "analyzing",
  "researching",
  "executing",
  "validating",
  "review",
  "blocked",
  "completed",
] as const;

export type MissionStatus = (typeof missionStatusOrder)[number];

export const workspaceModeSchema = z.enum(["cloud", "local", "hybrid"]);
export const riskLevelSchema = z.enum(["low", "moderate", "high", "critical"]);
export const agentRoleSchema = z.enum([
  "planner",
  "risk",
  "research",
  "review",
  "test",
  "debt",
  "security",
  "dependency",
  "coverage",
  "docs",
  "performance",
  "refactor",
  "innovation",
  "verification",
  "memory",
]);
export const agentStateSchema = z.enum([
  "idle",
  "analyzing",
  "researching",
  "executing",
  "validating",
  "blocked",
]);
export const missionStatusSchema = z.enum(missionStatusOrder);
export const autonomyModeSchema = z.enum([
  "proposal",
  "pull_request",
  "guarded_autonomy",
]);
export const documentKindSchema = z.enum([
  "product",
  "technical",
  "operations",
  "architecture",
  "runbook",
  "roadmap",
]);
export const documentStatusSchema = z.enum(["processing", "ready", "stale"]);
export const reviewDecisionSchema = z.enum([
  "pending",
  "approved",
  "needs_changes",
]);
export const memoryStrengthSchema = z.enum([
  "emerging",
  "stable",
  "fragile",
  "critical",
]);
export const workerStatusSchema = z.enum(["ready", "warming", "offline"]);
export const modelDepthSchema = z.enum(["focused", "balanced", "deep"]);
export const modelCostPolicySchema = z.enum(["efficient", "balanced", "premium"]);
export const modelLatencyPolicySchema = z.enum([
  "fast",
  "balanced",
  "deliberate",
]);
export const planCodeSchema = z.enum(["free", "starter", "pro", "enterprise"]);
export const toolCategorySchema = z.enum([
  "knowledge",
  "documentation",
  "research",
  "quality",
  "improvement",
  "qa_correction",
  "security",
  "optimization",
  "spaghetti_cleanup",
  "implementation",
]);
export const toolPartialOutputTypeSchema = z.enum([
  "reduced_scope",
  "diagnostic_only",
  "plan_only",
  "analysis_only",
]);
export const feasibilityVerdictSchema = z.enum([
  "full",
  "partial",
  "not_feasible",
]);
export const toolModelTierSchema = z.enum(["lite", "standard", "pro"]);
export const toolExecutionModeSchema = z.enum([
  "full",
  "partial",
  "diagnostic",
]);
export const toolExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);
export const toolFailureOriginSchema = z.enum([
  "aqelor_internal",
  "provider_external",
  "user_repository",
  "policy_block",
  "user_cancel",
  "timeout",
]);

const objectiveConfigSchema = z.object({
  enabled: z.boolean(),
  intensity: z.number().int().min(0).max(100),
  target: z.string(),
});

export const objectiveSettingsSchema = z.object({
  quality: objectiveConfigSchema,
  security: objectiveConfigSchema,
  technicalDebt: objectiveConfigSchema,
  dependencies: objectiveConfigSchema,
  coverage: objectiveConfigSchema,
  documentation: objectiveConfigSchema,
  performance: objectiveConfigSchema,
  innovation: objectiveConfigSchema,
  research: objectiveConfigSchema,
});

export const modelProfileSchema = z.object({
  primary: z.string(),
  fallback: z.string(),
  externalTools: z.boolean(),
  depth: modelDepthSchema,
  parallelism: z.number().int().min(1).max(15),
  costPolicy: modelCostPolicySchema,
  latencyPolicy: modelLatencyPolicySchema,
});

export const modelRouterSettingsSchema = z.object({
  planning: modelProfileSchema,
  implementation: modelProfileSchema,
  research: modelProfileSchema,
  review: modelProfileSchema,
  risk: modelProfileSchema,
  memory: modelProfileSchema,
});

export const policySettingsSchema = z.object({
  maxLinesPerMission: z.number().int().positive(),
  maxLinesPerFile: z.number().int().positive(),
  maxFilesTouched: z.number().int().positive(),
  allowedPaths: z.array(z.string()),
  blockedPaths: z.array(z.string()),
  criticalPaths: z.array(z.string()),
  allowedFileTypes: z.array(z.string()),
  blockedFileTypes: z.array(z.string()),
  maxConcurrentAgents: z.number().int().min(1).max(15),
  monthlyBudgetUsd: z.number().nonnegative(),
  executionWindow: z.string(),
  autonomyMode: autonomyModeSchema,
  requireHumanReviewAbove: riskLevelSchema,
});

export const agentStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: agentRoleSchema,
  state: agentStateSchema,
  currentMissionId: z.string().nullable(),
  currentMissionTitle: z.string().nullable(),
  risk: riskLevelSchema,
  costUsd: z.number().nonnegative(),
});

export const missionSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.enum(objectiveKeys),
  status: missionStatusSchema,
  risk: riskLevelSchema,
  summary: z.string(),
  touchedFiles: z.array(z.string()),
  changedLines: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  assignedAgents: z.array(z.string()),
  validations: z.array(z.string()),
  blockedReason: z.string().nullable(),
  startedAt: z.string(),
});

export const reviewCandidateSchema = z.object({
  id: z.string(),
  missionId: z.string(),
  decision: reviewDecisionSchema,
  summary: z.string(),
  beforeAfter: z.string(),
  risk: riskLevelSchema,
  filesTouched: z.array(z.string()),
  researchSources: z.array(z.string()),
  validations: z.array(z.string()),
});

export const memoryInsightSchema = z.object({
  id: z.string(),
  category: z.enum([
    "errors",
    "patterns",
    "decisions",
    "hotspots",
    "recommendations",
  ]),
  title: z.string(),
  summary: z.string(),
  strength: memoryStrengthSchema,
});

export const knowledgeDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: documentKindSchema,
  status: documentStatusSchema,
  version: z.string(),
  lastUpdatedAt: z.string(),
  useForAnalysis: z.boolean(),
  useForInnovation: z.boolean(),
});

export const billingSnapshotSchema = z.object({
  planName: z.string(),
  cycleLabel: z.string(),
  spendUsd: z.number().nonnegative(),
  limitUsd: z.number().positive(),
  repositoriesUsed: z.number().int().nonnegative(),
  repositoriesLimit: z.number().int().positive(),
  maxAgents: z.number().int().positive(),
});

export const workspaceSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  repositoryName: z.string(),
  repositoryProvider: z.string(),
  branch: z.string(),
  localRepositoryPath: z.string().nullable(),
  mode: workspaceModeSchema,
  vision: z.string(),
  planName: z.string(),
  objectives: objectiveSettingsSchema,
  modelRouter: modelRouterSettingsSchema,
  policies: policySettingsSchema,
  knowledgeBase: z.array(knowledgeDocumentSchema),
  agents: z.array(agentStatusSchema),
  missions: z.array(missionSchema),
  reviewQueue: z.array(reviewCandidateSchema),
  memoryInsights: z.array(memoryInsightSchema),
  billing: billingSnapshotSchema,
});

export const runtimeHealthSchema = z.object({
  appVersion: z.string(),
  platform: z.string(),
  workerMode: workspaceModeSchema,
  workerStatus: workerStatusSchema,
  lastSyncAt: z.string(),
});

export const aqelorToolDefinitionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: toolCategorySchema,
  costMinimumMicro: z.number().int().nonnegative(),
  costStandardMicro: z.number().int().nonnegative(),
  costFullMicro: z.number().int().nonnegative(),
  allowsPartial: z.boolean(),
  partialOutputType: toolPartialOutputTypeSchema.nullable(),
  isPremium: z.boolean(),
  riskLevel: riskLevelSchema,
  maxLinesPerExecution: z.number().int().positive().nullable(),
  maxFilesPerExecution: z.number().int().positive().nullable(),
  maxAgentsRequired: z.number().int().positive(),
  defaultModelTier: toolModelTierSchema,
  minPlanRequired: planCodeSchema,
  monthlyLimitFree: z.number().int().nonnegative().nullable(),
  monthlyLimitStarter: z.number().int().nonnegative().nullable(),
  monthlyLimitPro: z.number().int().nonnegative().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const aqelorWalletSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  balanceMicro: z.number().int().nonnegative(),
  reservedMicro: z.number().int().nonnegative(),
  lifetimeEarned: z.number().int().nonnegative(),
  lifetimeSpent: z.number().int().nonnegative(),
  lifetimeRefund: z.number().int().nonnegative(),
});

export const aqelorPlanLimitsSchema = z.object({
  planCode: planCodeSchema,
  maxAgentsAvailable: z.number().int().positive(),
  maxAgentsSimultaneous: z.number().int().positive(),
  maxRepositories: z.number().int().positive(),
  maxLinesPerExecution: z.number().int().positive(),
  maxFilesPerExecution: z.number().int().positive(),
  maxDailyExecutions: z.number().int().positive(),
  premiumToolsEnabled: z.boolean(),
  maxResearchQueriesDaily: z.number().int().nonnegative(),
  maxDocsUploaded: z.number().int().nonnegative(),
  maxDocSizeBytes: z.number().int().positive(),
  memoryRetentionDays: z.number().int().positive(),
  byokEnabled: z.boolean(),
  configurableModelRoles: z.array(z.string()),
});

export const aqelorToolUsageMonthlySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  toolDefinitionId: z.string(),
  periodYear: z.number().int().min(2024),
  periodMonth: z.number().int().min(1).max(12),
  executionCount: z.number().int().nonnegative(),
  auConsumedMicro: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
});

export const aqelorFeasibilityCheckSchema = z.object({
  id: z.string(),
  toolDefinitionId: z.string(),
  auAvailableMicro: z.number().int().nonnegative(),
  costMinimumMicro: z.number().int().nonnegative(),
  costStandardMicro: z.number().int().nonnegative(),
  costFullMicro: z.number().int().nonnegative(),
  verdict: feasibilityVerdictSchema,
  reason: z.string(),
  partialScope: z.string().nullable(),
  riskAssessment: z.string().nullable(),
  linesEstimated: z.number().int().nonnegative(),
  filesEstimated: z.number().int().nonnegative(),
  agentsRequired: z.number().int().positive(),
  agentsAvailable: z.number().int().nonnegative(),
  approved: z.boolean(),
  createdAt: z.string(),
});

export const aqelorToolExecutionSchema = z.object({
  id: z.string(),
  toolDefinitionId: z.string(),
  executionMode: toolExecutionModeSchema,
  modelUsed: z.string(),
  modelTier: toolModelTierSchema,
  status: toolExecutionStatusSchema,
  failureOrigin: toolFailureOriginSchema.nullable(),
  errorMessage: z.string().nullable(),
  auReservedMicro: z.number().int().nonnegative(),
  auConsumedMicro: z.number().int().nonnegative(),
  auRefundedMicro: z.number().int().nonnegative(),
  linesChanged: z.number().int().nonnegative(),
  filesTouched: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const autonomousDocRecordSchema = z.object({
  id: z.string(),
  docType: z.string(),
  title: z.string(),
  createdAt: z.string(),
});

export const billingProviderSchema = z.enum([
  "disabled",
  "stripe",
  "mercado_pago",
  "custom",
]);

export const subscriptionBillingCycleSchema = z.enum(["monthly", "yearly"]);
export const billingCycleSchema = z.enum(["monthly", "yearly", "one_time"]);
export const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
  "unpaid",
]);
export const billingCheckoutSessionStatusSchema = z.enum([
  "pending",
  "open",
  "completed",
  "expired",
  "cancelled",
  "failed",
  "requires_gateway",
]);
export const billingCheckoutKindSchema = z.enum([
  "subscription",
  "au_pack",
]);
export const billingEventTypeSchema = z.enum([
  "payment_succeeded",
  "payment_failed",
  "subscription_created",
  "subscription_updated",
  "subscription_canceled",
  "refund",
  "trial_started",
  "trial_ended",
  "invoice_created",
  "checkout_session_created",
  "checkout_session_completed",
  "portal_session_created",
  "pack_purchase_completed",
]);
export const auTransactionTypeSchema = z.enum([
  "purchase",
  "consumption",
  "reservation",
  "release",
  "refund",
  "expiration",
  "adjustment",
  "bonus",
]);
export const auPackPurchaseStatusSchema = z.enum([
  "initiated",
  "awaiting_payment",
  "paid",
  "credited",
  "failed",
  "cancelled",
  "refunded",
]);
export const billingGatewayModeSchema = z.enum(["stub", "partial", "ready"]);

export const planAuAllocationSchema = z.object({
  planCode: planCodeSchema,
  monthlyMicro: z.number().int().nonnegative(),
  rollover: z.boolean(),
  maxRolloverMicro: z.number().int().nonnegative(),
});

export const billingGatewayStateSchema = z.object({
  provider: billingProviderSchema,
  configured: z.boolean(),
  mode: billingGatewayModeSchema,
  publicLabel: z.string(),
  message: z.string(),
});

export const billingCustomerRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  defaultWorkspaceId: z.string().nullable(),
  provider: billingProviderSchema,
  providerCustomerId: z.string().nullable(),
  email: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});

export const billingPlanOfferSchema = z.object({
  id: z.string(),
  code: z.string(),
  planCode: planCodeSchema,
  billingCycle: subscriptionBillingCycleSchema,
  displayName: z.string(),
  description: z.string(),
  priceUsd: z.number().nullable(),
  currency: z.string(),
  budgetLimitUsd: z.number().nonnegative(),
  provider: billingProviderSchema,
  providerLookupKey: z.string().nullable(),
  isCustomPrice: z.boolean(),
  trialDays: z.number().int().nonnegative(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  includedAuMonthly: z.number().int().nonnegative(),
});

export const billingSubscriptionRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: billingProviderSchema,
  providerCustomerId: z.string().nullable(),
  providerSubscriptionId: z.string().nullable(),
  offerCode: z.string().nullable(),
  planCode: planCodeSchema,
  status: subscriptionStatusSchema,
  billingCycle: subscriptionBillingCycleSchema,
  budgetLimitUsd: z.number().nonnegative(),
  maxRepositories: z.number().int().positive(),
  maxAgents: z.number().int().positive(),
  agentsAvailable: z.number().int().positive(),
  agentsSimultaneous: z.number().int().positive(),
  auIncludedMonthly: z.number().int().nonnegative(),
  auRollover: z.boolean(),
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  nextBillingAt: z.string().nullable(),
  paymentMethodSummary: z.string().nullable(),
  statusReason: z.string(),
  createdAt: z.string(),
});

export const auPackCatalogSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  amountMicro: z.number().int().positive(),
  priceUsd: z.number().nonnegative(),
  bonusMicro: z.number().int().nonnegative(),
  currency: z.string(),
  provider: billingProviderSchema,
  providerLookupKey: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const auTransactionRecordSchema = z.object({
  id: z.string(),
  walletId: z.string(),
  transactionType: auTransactionTypeSchema,
  amountMicro: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  description: z.string(),
  createdAt: z.string(),
});

export const billingCheckoutSessionRecordSchema = z.object({
  id: z.string(),
  sessionKind: billingCheckoutKindSchema,
  status: billingCheckoutSessionStatusSchema,
  provider: billingProviderSchema,
  userId: z.string(),
  workspaceId: z.string(),
  subscriptionId: z.string().nullable(),
  planOfferId: z.string().nullable(),
  auPackId: z.string().nullable(),
  providerCustomerId: z.string().nullable(),
  providerSessionId: z.string().nullable(),
  providerPaymentIntentId: z.string().nullable(),
  checkoutUrl: z.string().nullable(),
  currency: z.string(),
  amountUsd: z.number().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const auPackPurchaseRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  auPackId: z.string(),
  checkoutSessionId: z.string().nullable(),
  status: auPackPurchaseStatusSchema,
  grossAmountUsd: z.number().nonnegative(),
  currency: z.string(),
  provider: billingProviderSchema,
  providerPaymentId: z.string().nullable(),
  creditedMicro: z.number().int().nonnegative(),
  bonusCreditedMicro: z.number().int().nonnegative(),
  creditedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const billingEventRecordSchema = z.object({
  id: z.string(),
  subscriptionId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  checkoutSessionId: z.string().nullable(),
  packPurchaseId: z.string().nullable(),
  provider: billingProviderSchema,
  eventType: billingEventTypeSchema,
  providerEventId: z.string().nullable(),
  amountUsd: z.number().nullable(),
  currency: z.string(),
  createdAt: z.string(),
});

// ─── AutoDev / Worker Pipeline Schemas ─────────────────────────────

export const pipelineModeSchema = z.enum(["full", "micro"]);

export const runStrategySchema = z.enum([
  "innovation",
  "deep-improvement",
  "user-driven",
  "gap-filling",
  "integration",
  "resilience",
]);

export const workerRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "aborted",
]);

export const safetyGuardResultSchema = z.object({
  guard: z.string(),
  passed: z.boolean(),
  reason: z.string(),
});

export const improvementCategorySchema = z.enum([
  "security",
  "quality",
  "performance",
  "dependencies",
  "tests",
  "features",
]);

export const improvementSchema = z.object({
  file: z.string(),
  category: improvementCategorySchema,
  description: z.string(),
  diff: z.string().optional(),
  applied: z.boolean(),
  researchSources: z.array(z.string()),
  agentRole: agentRoleSchema,
});

export const researchFindingSchema = z.object({
  query: z.string(),
  category: improvementCategorySchema,
  findings: z.string(),
  sources: z.array(z.string()),
  actionable: z.boolean(),
  agentRole: agentRoleSchema,
});

export const microFixTriggerSchema = z.object({
  category: z.string(),
  description: z.string(),
  userMessage: z.string().optional(),
  source: z.string(),
  timestamp: z.string(),
});

export const workerRunSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  mode: pipelineModeSchema,
  strategy: runStrategySchema.optional(),
  status: workerRunStatusSchema,
  branchName: z.string().optional(),
  prUrl: z.string().optional(),
  improvementsCount: z.number().int().nonnegative(),
  summary: z.string(),
  error: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export const workerConfigSchema = z.object({
  enabled: z.boolean(),
  cronSchedule: z.string(),
  maxDailyRuns: z.number().int().positive(),
  maxDailyMicroRuns: z.number().int().positive(),
  microFixEnabled: z.boolean(),
  microFixDebounceMinutes: z.number().int().nonnegative(),
  workBranchPrefix: z.string(),
  autoMerge: z.boolean(),
  requireBuildPass: z.boolean(),
  maxFilesPerRun: z.number().int().positive(),
  maxLinesChanged: z.number().int().positive(),
  maxResearchQueries: z.number().int().positive(),
});

export const parsedBuildErrorSchema = z.object({
  file: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  code: z.string().optional(),
  message: z.string(),
});

export const selfLearnCategorySchema = z.enum([
  "user_complaint",
  "user_suggestion",
  "tool_failure",
  "computer_use_fail",
  "unverified_action",
  "api_limitation",
  "hallucination",
]);

export const strategicGoalAreaSchema = z.enum([
  "whatsapp",
  "automation",
  "computer-use",
  "integrations",
  "infrastructure",
  "ux",
  "security",
  "autodev",
]);

export const strategicGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["pending", "in_progress", "completed", "abandoned"]),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  relatedRuns: z.array(z.string()),
  area: strategicGoalAreaSchema,
});

export const capabilityStatusSchema = z.enum([
  "functional",
  "partial",
  "broken",
  "missing",
]);

export const capabilityEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  status: capabilityStatusSchema,
  files: z.array(z.string()),
  lastVerified: z.string(),
  gaps: z.array(z.string()).optional(),
});

export const runRetrospectiveSchema = z.object({
  runId: z.string(),
  date: z.string(),
  strategy: runStrategySchema,
  intent: z.string(),
  outcome: z.string(),
  impactScore: z.number().int().min(1).max(5),
  lessons: z.array(z.string()),
  mistakes: z.array(z.string()),
  orphanedFiles: z.array(z.string()),
  realImprovementsCount: z.number().int().nonnegative(),
  durationMinutes: z.number().nonnegative(),
});

export const userPatternSchema = z.object({
  pattern: z.string(),
  frequency: z.number().int().positive(),
  lastSeen: z.string(),
  category: z.enum(["complaint", "request", "suggestion", "praise"]),
  addressed: z.boolean(),
});

export const errorMemoryEntrySchema = z.object({
  pattern: z.string(),
  file: z.string(),
  fix: z.string(),
  occurrences: z.number().int().positive(),
  lastSeen: z.string(),
});

export const toolDeclarationSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(
      z.string(),
      z.object({
        type: z.string(),
        description: z.string(),
      }),
    ),
    required: z.array(z.string()).optional(),
  }),
});

// ─── Type Exports ──────────────────────────────────────────────────

export type WorkspaceMode = z.infer<typeof workspaceModeSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type AgentRole = z.infer<typeof agentRoleSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;
export type AutonomyMode = z.infer<typeof autonomyModeSchema>;
export type ObjectiveSettings = z.infer<typeof objectiveSettingsSchema>;
export type ModelDepth = z.infer<typeof modelDepthSchema>;
export type ModelCostPolicy = z.infer<typeof modelCostPolicySchema>;
export type ModelLatencyPolicy = z.infer<typeof modelLatencyPolicySchema>;
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export type ModelRouterSettings = z.infer<typeof modelRouterSettingsSchema>;
export type PolicySettings = z.infer<typeof policySettingsSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type ReviewCandidate = z.infer<typeof reviewCandidateSchema>;
export type MemoryInsight = z.infer<typeof memoryInsightSchema>;
export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
export type BillingSnapshot = z.infer<typeof billingSnapshotSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type RuntimeHealth = z.infer<typeof runtimeHealthSchema>;
export type PlanCode = z.infer<typeof planCodeSchema>;
export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type ToolPartialOutputType = z.infer<typeof toolPartialOutputTypeSchema>;
export type FeasibilityVerdict = z.infer<typeof feasibilityVerdictSchema>;
export type ToolModelTier = z.infer<typeof toolModelTierSchema>;
export type ToolExecutionMode = z.infer<typeof toolExecutionModeSchema>;
export type ToolExecutionStatus = z.infer<typeof toolExecutionStatusSchema>;
export type ToolFailureOrigin = z.infer<typeof toolFailureOriginSchema>;
export type AqelorToolDefinition = z.infer<typeof aqelorToolDefinitionSchema>;
export type AqelorWallet = z.infer<typeof aqelorWalletSchema>;
export type AqelorPlanLimits = z.infer<typeof aqelorPlanLimitsSchema>;
export type AqelorToolUsageMonthly = z.infer<typeof aqelorToolUsageMonthlySchema>;
export type AqelorFeasibilityCheck = z.infer<typeof aqelorFeasibilityCheckSchema>;
export type AqelorToolExecution = z.infer<typeof aqelorToolExecutionSchema>;
export type AutonomousDocRecord = z.infer<typeof autonomousDocRecordSchema>;
export type BillingProvider = z.infer<typeof billingProviderSchema>;
export type SubscriptionBillingCycle = z.infer<typeof subscriptionBillingCycleSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type BillingCheckoutSessionStatus = z.infer<typeof billingCheckoutSessionStatusSchema>;
export type BillingCheckoutKind = z.infer<typeof billingCheckoutKindSchema>;
export type BillingEventType = z.infer<typeof billingEventTypeSchema>;
export type AuTransactionType = z.infer<typeof auTransactionTypeSchema>;
export type AuPackPurchaseStatus = z.infer<typeof auPackPurchaseStatusSchema>;
export type BillingGatewayMode = z.infer<typeof billingGatewayModeSchema>;
export type PlanAuAllocation = z.infer<typeof planAuAllocationSchema>;
export type BillingGatewayState = z.infer<typeof billingGatewayStateSchema>;
export type BillingCustomerRecord = z.infer<typeof billingCustomerRecordSchema>;
export type BillingPlanOffer = z.infer<typeof billingPlanOfferSchema>;
export type BillingSubscriptionRecord = z.infer<typeof billingSubscriptionRecordSchema>;
export type AuPackCatalog = z.infer<typeof auPackCatalogSchema>;
export type AuTransactionRecord = z.infer<typeof auTransactionRecordSchema>;
export type BillingCheckoutSessionRecord = z.infer<typeof billingCheckoutSessionRecordSchema>;
export type AuPackPurchaseRecord = z.infer<typeof auPackPurchaseRecordSchema>;
export type BillingEventRecord = z.infer<typeof billingEventRecordSchema>;
export type PipelineMode = z.infer<typeof pipelineModeSchema>;
export type RunStrategy = z.infer<typeof runStrategySchema>;
export type WorkerRunStatus = z.infer<typeof workerRunStatusSchema>;
export type SafetyGuardResult = z.infer<typeof safetyGuardResultSchema>;
export type ImprovementCategory = z.infer<typeof improvementCategorySchema>;
export type Improvement = z.infer<typeof improvementSchema>;
export type ResearchFinding = z.infer<typeof researchFindingSchema>;
export type MicroFixTrigger = z.infer<typeof microFixTriggerSchema>;
export type WorkerRun = z.infer<typeof workerRunSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;
export type ParsedBuildError = z.infer<typeof parsedBuildErrorSchema>;
export type SelfLearnCategory = z.infer<typeof selfLearnCategorySchema>;
export type StrategicGoalArea = z.infer<typeof strategicGoalAreaSchema>;
export type StrategicGoal = z.infer<typeof strategicGoalSchema>;
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;
export type RunRetrospective = z.infer<typeof runRetrospectiveSchema>;
export type UserPattern = z.infer<typeof userPatternSchema>;
export type ErrorMemoryEntry = z.infer<typeof errorMemoryEntrySchema>;
export type ToolDeclaration = z.infer<typeof toolDeclarationSchema>;
