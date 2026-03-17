/**
 * Pipeline Planner — Decide qué fases ejecutar y en qué orden.
 * Funciones puras para pipelines full (7 fases) y micro (4 fases).
 */
import type {
  Improvement,
  MicroFixTrigger,
  MissionStatus,
  RunStrategy,
  WorkspaceSnapshot,
} from "@auria/contracts";

// ─── Pipeline Phase Definitions ────────────────────────────────────

export type FullPipelinePhase =
  | "strategic-awareness"
  | "parallel-research"
  | "deep-research"
  | "analysis-planning"
  | "parallel-coding"
  | "review-build"
  | "commit-pr"
  | "retrospective";

export type MicroFixPhase =
  | "analyze"
  | "fix"
  | "build-verify"
  | "commit";

export interface PipelineStep<P extends string = string> {
  phase: P;
  description: string;
  /** Which mission status corresponds to this phase */
  missionStatus: MissionStatus;
  /** Whether this phase can run agents in parallel */
  parallel: boolean;
}

// ─── Full Pipeline Plan ────────────────────────────────────────────

const FULL_PIPELINE: PipelineStep<FullPipelinePhase>[] = [
  {
    phase: "strategic-awareness",
    description: "Selección de estrategia y contexto histórico",
    missionStatus: "analyzing",
    parallel: false,
  },
  {
    phase: "parallel-research",
    description: "Investigación paralela: seguridad, dependencias, calidad, features",
    missionStatus: "researching",
    parallel: true,
  },
  {
    phase: "deep-research",
    description: "Investigación profunda con herramientas web (search, read)",
    missionStatus: "researching",
    parallel: false,
  },
  {
    phase: "analysis-planning",
    description: "Análisis del codebase y planificación de mejoras",
    missionStatus: "analyzing",
    parallel: false,
  },
  {
    phase: "parallel-coding",
    description: "Implementación paralela de mejoras por agentes especializados",
    missionStatus: "executing",
    parallel: true,
  },
  {
    phase: "review-build",
    description: "Self-review de cambios + verificación de build (tsc, vite)",
    missionStatus: "validating",
    parallel: false,
  },
  {
    phase: "commit-pr",
    description: "Commit de cambios, push a rama, creación de PR",
    missionStatus: "review",
    parallel: false,
  },
  {
    phase: "retrospective",
    description: "Auto-evaluación del run y actualización de memoria estratégica",
    missionStatus: "completed",
    parallel: false,
  },
];

// ─── Micro-Fix Pipeline Plan ───────────────────────────────────────

const MICRO_PIPELINE: PipelineStep<MicroFixPhase>[] = [
  {
    phase: "analyze",
    description: "Análisis del problema reportado contra el codebase",
    missionStatus: "analyzing",
    parallel: false,
  },
  {
    phase: "fix",
    description: "Generación y aplicación de la corrección mínima",
    missionStatus: "executing",
    parallel: false,
  },
  {
    phase: "build-verify",
    description: "Verificación de que el build pasa correctamente",
    missionStatus: "validating",
    parallel: false,
  },
  {
    phase: "commit",
    description: "Commit directo a rama de trabajo (sin PR para micro-fixes)",
    missionStatus: "completed",
    parallel: false,
  },
];

// ─── Public Functions ──────────────────────────────────────────────

export function buildFullPipelinePlan(
  _snapshot: WorkspaceSnapshot,
  _strategy: RunStrategy,
): PipelineStep<FullPipelinePhase>[] {
  // El pipeline completo siempre ejecuta las 8 fases en orden.
  // En el futuro se pueden saltar fases según estrategia.
  return [...FULL_PIPELINE];
}

export function buildMicroFixPlan(
  _trigger: MicroFixTrigger,
  _snapshot: WorkspaceSnapshot,
): PipelineStep<MicroFixPhase>[] {
  return [...MICRO_PIPELINE];
}

/**
 * Filtra planes dominados por dependencias (>50% del plan son dependencies).
 * Retorna true si el plan debe ser rechazado.
 */
export function shouldFilterDependencyImprovements(
  improvements: Improvement[],
): boolean {
  if (improvements.length === 0) return false;
  const depCount = improvements.filter(
    (i) => i.category === "dependencies",
  ).length;
  return depCount / improvements.length > 0.5;
}

/**
 * Filtra mejoras que son solo actualizaciones de dependencias major.
 * Retorna la lista limpia sin esas mejoras.
 */
export function filterBlockedImprovements(
  improvements: Improvement[],
): Improvement[] {
  return improvements.filter((imp) => {
    // Rechazar mejoras de dependencias que son solo version bumps
    if (imp.category === "dependencies") {
      const isJustUpdate =
        /actualiz|updat|upgrade|bump/i.test(imp.description) &&
        !/vulnerabilid|critical|cve/i.test(imp.description);
      return !isJustUpdate;
    }
    return true;
  });
}
