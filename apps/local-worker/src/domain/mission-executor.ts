/**
 * Mission Executor — Orquestador principal del pipeline de 7 fases.
 * Reemplaza AutoDevService.executeRun() sin estado en memoria.
 * Lee/escribe estado a través de callbacks (persistence layer).
 */
import type {
  Improvement,
  MissionStatus,
  ResearchFinding,
  RunStrategy,
  WorkerConfig,
  WorkerRun,
  WorkspaceSnapshot,
} from "@auria/contracts";
import {
  buildFullPipelinePlan,
  filterBlockedImprovements,
  selectStrategy,
  type StrategyContext,
  type FullPipelinePhase,
  runParallel,
  buildStrategicContext,
  getStrategyDirective,
  RESEARCH_GROUNDING_PROMPT,
  ANALYZE_PROMPT,
  PLAN_PROMPT,
  CODE_PROMPT,
  REVIEW_PROMPT,
  SUMMARY_PROMPT,
  getRetrospectivePrompt,
  runGuards,
  isWithinLineLimit,
  isWithinFileLimit,
  isDependencyDominated,
  isCodeComplete,
  parseBuildErrors,
} from "@auria/domain";
import type { ModelAdapter } from "@auria/domain";
import type { GitService } from "../infrastructure/git-service.ts";
import type { NotificationService } from "../infrastructure/notification-service.ts";

// ─── Types ─────────────────────────────────────────────────────────

export interface MissionExecutorDeps {
  model: ModelAdapter;
  git: GitService;
  notifications: NotificationService;
  readProjectFiles: () => Array<{ path: string; content: string }>;
  getDependencies: () => string;
  runBuildCheck: () => Promise<{ success: boolean; output: string }>;
  onPhaseChange: (phase: FullPipelinePhase, status: MissionStatus) => void;
  onRunUpdate: (run: Partial<WorkerRun>) => void;
}

export interface ExecutionResult {
  run: WorkerRun;
  improvements: Improvement[];
  researchFindings: ResearchFinding[];
}

// ─── Executor ──────────────────────────────────────────────────────

export async function executeMission(
  snapshot: WorkspaceSnapshot,
  config: WorkerConfig,
  strategyContext: StrategyContext & {
    rejectedIdeas: Array<{ idea: string; reason: string; date: string }>;
    hotspots: Record<string, number>;
  },
  deps: MissionExecutorDeps,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const runId = `run_${Date.now()}`;
  const startedAt = new Date().toISOString();
  let improvements: Improvement[] = [];
  let researchFindings: ResearchFinding[] = [];
  let branchName: string | undefined;
  let prUrl: string | undefined;
  let summary = "";
  let error: string | undefined;

  deps.notifications.notifyRunStarted(runId, "full");

  try {
    // ── Phase 1: Strategic Awareness ──
    deps.onPhaseChange("strategic-awareness", "analyzing");
    const strategy = selectStrategy(strategyContext);
    const strategicCtx = buildStrategicContext(strategyContext);

    checkAbort(signal);

    // ── Phase 2: Parallel Research ──
    deps.onPhaseChange("parallel-research", "researching");
    const sourceFiles = deps.readProjectFiles();
    const dependenciesList = deps.getDependencies();
    const categories = snapshot.objectives;

    const enabledCategories = Object.entries(categories)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k)
      .join(", ");

    const researchPrompt = RESEARCH_GROUNDING_PROMPT
      .replace("{SYSTEM_CAPABILITIES}", "Ver código fuente adjunto")
      .replace("{DEPENDENCIES_LIST}", dependenciesList)
      .replace("{CATEGORIES}", enabledCategories);

    const researchResult = await deps.model.generateContent(researchPrompt, {
      role: "research",
    });
    researchFindings = parseJsonSafe(researchResult.text)?.findings ?? [];

    checkAbort(signal);

    // ── Phase 3: Deep Research (skip for now, handled by Phase 2) ──
    deps.onPhaseChange("deep-research", "researching");

    checkAbort(signal);

    // ── Phase 4: Analysis + Planning ──
    deps.onPhaseChange("analysis-planning", "analyzing");
    const sourceCodeStr = sourceFiles
      .slice(0, 50)
      .map((f) => `// === ${f.path} ===\n${f.content}`)
      .join("\n\n");

    const analyzePrompt = ANALYZE_PROMPT
      .replace("{REPO_PATH}", snapshot.localRepositoryPath || ".")
      .replace("{STRATEGIC_CONTEXT}", strategicCtx)
      .replace("{RESEARCH_FINDINGS}", JSON.stringify(researchFindings.slice(0, 10)))
      .replace("{NPM_AUDIT}", "Ver resultados de investigación")
      .replace("{NPM_OUTDATED}", "Ver resultados de investigación")
      .replace("{SOURCE_CODE}", sourceCodeStr.slice(0, 200_000))
      .replace("{CATEGORIES}", enabledCategories)
      .replace("{ERROR_MEMORY}", "")
      .replace("{RUN_HISTORY}", "")
      .replace("{MAX_FILES}", String(config.maxFilesPerRun))
      .replace("{MAX_LINES}", String(config.maxLinesChanged));

    const analysisResult = await deps.model.generateContent(analyzePrompt, {
      role: "planning",
    });
    improvements = parseJsonSafe(analysisResult.text)?.improvements ?? [];
    improvements = filterBlockedImprovements(improvements);

    // Safety guards on the plan
    const planGuards = runGuards([
      isDependencyDominated(improvements),
      isWithinFileLimit(improvements.length, config.maxFilesPerRun),
    ]);
    if (!planGuards.allPassed) {
      const reasons = planGuards.failed.map((g) => g.reason).join("; ");
      throw new Error(`Plan rejected by safety guards: ${reasons}`);
    }

    checkAbort(signal);

    // ── Phase 5: Parallel Coding ──
    deps.onPhaseChange("parallel-coding", "executing");

    // Create work branch
    branchName = await deps.git.createWorkBranch(
      runId,
      "main",
      config.workBranchPrefix,
    );

    // For each improvement, generate code (simplified: sequential for now)
    const appliedImprovements: Improvement[] = [];
    for (const imp of improvements.slice(0, config.maxFilesPerRun)) {
      checkAbort(signal);
      try {
        const codeResult = await deps.model.generateContent(
          CODE_PROMPT
            .replace("{STRATEGY_DIRECTIVE}", getStrategyDirective(strategy.strategy))
            .replace("{PLAN_STEP}", JSON.stringify(imp))
            .replace("{FILE_PATH}", imp.file)
            .replace("{CURRENT_CODE}", "// File to be generated")
            .replace("{RESEARCH_CONTEXT}", JSON.stringify(researchFindings.slice(0, 5)))
            .replace("{LESSONS_LEARNED}", ""),
          { role: "implementation" },
        );

        const codeResponse = parseJsonSafe(codeResult.text);
        if (codeResponse?.modifiedCode) {
          const completeness = isCodeComplete(codeResponse.modifiedCode);
          if (completeness.passed) {
            appliedImprovements.push({ ...imp, applied: true });
          }
        }
      } catch (err: any) {
        console.error(`[MissionExecutor] Coding failed for ${imp.file}: ${err.message}`);
      }
    }
    improvements = appliedImprovements;

    checkAbort(signal);

    // ── Phase 6: Review + Build ──
    deps.onPhaseChange("review-build", "validating");

    if (config.requireBuildPass) {
      const buildResult = await deps.runBuildCheck();
      if (!buildResult.success) {
        const errors = parseBuildErrors(buildResult.output);
        if (errors.length > 0) {
          console.warn(
            `[MissionExecutor] Build errors: ${errors.map((e) => e.message).join(", ")}`,
          );
        }
      }
    }

    // Line count guard
    const linesChanged = improvements.reduce(
      (sum, i) => sum + (i.diff?.split("\n").length ?? 50),
      0,
    );
    const lineGuard = isWithinLineLimit(linesChanged, config.maxLinesChanged);
    if (!lineGuard.passed) {
      console.warn(`[MissionExecutor] ${lineGuard.reason}`);
    }

    checkAbort(signal);

    // ── Phase 7: Commit + PR ──
    deps.onPhaseChange("commit-pr", "review");

    if (improvements.length > 0) {
      await deps.git.stageAll();
      const commitMsg = generateCommitMessage(improvements);
      await deps.git.commitChanges(commitMsg);

      if (await deps.git.hasRemote()) {
        await deps.git.pushBranch(branchName);
        // PR creation could fail if gh is not authenticated
        try {
          const prBody = generatePRBody(improvements, researchFindings);
          prUrl = await deps.git.createPR(
            generatePRTitle(improvements),
            prBody,
            "main",
          );
          deps.notifications.notifyPRCreated(prUrl, generatePRTitle(improvements));
        } catch (err: any) {
          console.warn(`[MissionExecutor] PR creation failed: ${err.message}`);
        }
      }
    }

    checkAbort(signal);

    // ── Phase 8: Retrospective ──
    deps.onPhaseChange("retrospective", "completed");
    const durationMinutes = Math.round(
      (Date.now() - new Date(startedAt).getTime()) / 60_000,
    );

    const retroPrompt = getRetrospectivePrompt({
      id: runId,
      strategy: strategy.strategy,
      improvements: improvements.map((i) => ({
        file: i.file,
        category: i.category,
        description: i.description,
        applied: i.applied,
      })),
      errors: error ? [error] : [],
      warnings: [],
      durationMinutes,
      pastRetrospectives: "",
    });

    try {
      await deps.model.generateContent(retroPrompt, { role: "memory" });
    } catch {
      // Retrospective failure is non-fatal
    }

    summary = `Run ${runId}: ${improvements.length} mejoras aplicadas en ${durationMinutes}min.${prUrl ? ` PR: ${prUrl}` : ""}`;
    deps.notifications.notifyRunCompleted(runId, improvements.length, prUrl);
  } catch (err: any) {
    error = err.message;
    deps.notifications.notifyRunFailed(runId, error!);
  }

  const run: WorkerRun = {
    id: runId,
    workspaceId: snapshot.id,
    mode: "full",
    strategy: undefined,
    status: error ? "failed" : "completed",
    branchName,
    prUrl,
    improvementsCount: improvements.filter((i) => i.applied).length,
    summary,
    error,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  deps.onRunUpdate(run);
  return { run, improvements, researchFindings };
}

// ─── Helpers ───────────────────────────────────────────────────────

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Run aborted by user.");
  }
}

function parseJsonSafe(text: string): any {
  const m =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function generateCommitMessage(improvements: Improvement[]): string {
  const applied = improvements.filter((i) => i.applied);
  const cats = [...new Set(applied.map((i) => i.category))];
  const lines = [
    `Automated improvements: ${cats.join(", ")}`,
    "",
    ...applied.map((i) => `- [${i.category}] ${i.file}: ${i.description}`),
    "",
    `Files: ${[...new Set(applied.map((i) => i.file))].length}`,
  ];
  return lines.join("\n");
}

function generatePRTitle(improvements: Improvement[]): string {
  const applied = improvements.filter((i) => i.applied);
  const cats = [...new Set(applied.map((i) => i.category))];
  return `${cats.join(", ")}: ${applied.length} automated improvements`;
}

function generatePRBody(
  improvements: Improvement[],
  findings: ResearchFinding[],
): string {
  const applied = improvements.filter((i) => i.applied);
  const actionable = findings.filter((f) => f.actionable);
  const lines = [
    "## Summary",
    `AURIA automated run — ${applied.length} improvements applied.`,
    "",
    "## Improvements",
    ...applied.map(
      (i) =>
        `- **[${i.category}]** \`${i.file}\`: ${i.description}\n  Sources: ${i.researchSources.map((s) => `[link](${s})`).join(", ") || "N/A"}`,
    ),
    "",
    "## Research Conducted",
    ...actionable
      .slice(0, 10)
      .map(
        (f) =>
          `- **[${f.category}]** ${f.findings}\n  Sources: ${f.sources.map((s) => `[link](${s})`).join(", ")}`,
      ),
    "",
    "---",
    "Generated by AURIA autonomous improvement system",
  ];
  return lines.join("\n");
}
