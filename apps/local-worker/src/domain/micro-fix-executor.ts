/**
 * Micro-Fix Executor — Pipeline simplificado de 4 fases.
 * Analyze → Fix → Build Verify → Commit.
 * Para correcciones rápidas y reactivas.
 */
import type {
  MicroFixTrigger,
  WorkerConfig,
  WorkerRun,
  WorkspaceSnapshot,
} from "@auria/contracts";
import {
  MICRO_FIX_ANALYZE_PROMPT,
  MICRO_FIX_CODE_PROMPT,
  MICRO_FIX_SUMMARY_PROMPT,
  parseBuildErrors,
} from "@auria/domain";
import type { ModelAdapter } from "@auria/domain";
import type { GitService } from "../infrastructure/git-service.ts";
import type { NotificationService } from "../infrastructure/notification-service.ts";

export interface MicroFixDeps {
  model: ModelAdapter;
  git: GitService;
  notifications: NotificationService;
  readProjectFiles: () => Array<{ path: string; content: string }>;
  runBuildCheck: () => Promise<{ success: boolean; output: string }>;
  onRunUpdate: (run: Partial<WorkerRun>) => void;
}

export async function executeMicroFix(
  trigger: MicroFixTrigger,
  snapshot: WorkspaceSnapshot,
  config: WorkerConfig,
  deps: MicroFixDeps,
): Promise<WorkerRun> {
  const runId = `micro_${Date.now()}`;
  const startedAt = new Date().toISOString();
  let error: string | undefined;
  let summary = "";

  deps.notifications.notifyRunStarted(runId, "micro");

  try {
    // ── Phase 1: Analyze ──
    const sourceFiles = deps.readProjectFiles();
    const relevantCode = sourceFiles
      .slice(0, 20)
      .map((f) => `// === ${f.path} ===\n${f.content}`)
      .join("\n\n")
      .slice(0, 100_000);

    const analyzePrompt = MICRO_FIX_ANALYZE_PROMPT
      .replace("{TRIGGER_CONTEXT}", JSON.stringify(trigger))
      .replace("{SOURCE_CODE}", relevantCode)
      .replace("{RELATED_ISSUES}", "");

    const analysisResult = await deps.model.generateContent(analyzePrompt, {
      role: "planning",
    });
    const analysis = parseJsonSafe(analysisResult.text);

    if (!analysis || analysis.needs_full_run) {
      return createRun(runId, snapshot.id, startedAt, "completed", "Micro-fix requires full run. Skipped.");
    }

    if (analysis.risk_level === "high") {
      return createRun(runId, snapshot.id, startedAt, "completed", "Micro-fix risk too high. Skipped.");
    }

    // ── Phase 2: Fix ──
    const plan = analysis.plan || [];
    if (plan.length === 0) {
      return createRun(runId, snapshot.id, startedAt, "completed", "No fixes needed.");
    }

    // Create work branch
    const branchName = await deps.git.createWorkBranch(
      runId,
      "main",
      config.workBranchPrefix,
    );

    for (const step of plan.slice(0, 5)) {
      try {
        const codePrompt = MICRO_FIX_CODE_PROMPT
          .replace("{FIX_PLAN}", JSON.stringify(step))
          .replace("{FILE_CONTENT}", "// File content to be read");

        await deps.model.generateContent(codePrompt, {
          role: "implementation",
        });
      } catch (err: any) {
        console.warn(`[MicroFix] Step failed: ${err.message}`);
      }
    }

    // ── Phase 3: Build Verify ──
    if (config.requireBuildPass) {
      const buildResult = await deps.runBuildCheck();
      if (!buildResult.success) {
        const errors = parseBuildErrors(buildResult.output);
        if (errors.length > 0) {
          // Revert and abort
          await deps.git.cleanupBranch(branchName);
          return createRun(
            runId,
            snapshot.id,
            startedAt,
            "failed",
            `Build failed: ${errors[0].message}`,
          );
        }
      }
    }

    // ── Phase 4: Commit ──
    const hasChanges = await deps.git.hasUncommittedChanges();
    if (hasChanges) {
      await deps.git.stageAll();
      await deps.git.commitChanges(
        `[micro-fix] ${trigger.description.slice(0, 72)}`,
      );
    }

    // Generate summary
    try {
      const summaryResult = await deps.model.generateContent(
        MICRO_FIX_SUMMARY_PROMPT
          .replace("{CHANGES}", JSON.stringify(plan))
          .replace("{TRIGGER}", JSON.stringify(trigger)),
        { role: "memory" },
      );
      summary = summaryResult.text.slice(0, 500);
    } catch {
      summary = `Micro-fix: ${trigger.description.slice(0, 100)}`;
    }

    deps.notifications.notifyRunCompleted(runId, plan.length);
  } catch (err: any) {
    error = err.message;
    deps.notifications.notifyRunFailed(runId, error!);
  }

  const run = createRun(
    runId,
    snapshot.id,
    startedAt,
    error ? "failed" : "completed",
    summary,
    error,
  );
  deps.onRunUpdate(run);
  return run;
}

function createRun(
  id: string,
  workspaceId: string,
  startedAt: string,
  status: "completed" | "failed",
  summary: string,
  error?: string,
): WorkerRun {
  return {
    id,
    workspaceId,
    mode: "micro",
    status,
    summary,
    error,
    improvementsCount: 0,
    startedAt,
    completedAt: new Date().toISOString(),
  };
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
