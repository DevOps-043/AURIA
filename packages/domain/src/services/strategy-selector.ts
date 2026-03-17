/**
 * Strategy Selector — Selecciona la mejor estrategia para el próximo run.
 * Función pura: dado el contexto histórico, retorna estrategia + razón.
 * Extraído de autodev-strategic-memory.ts líneas 177-240.
 */
import type {
  CapabilityEntry,
  RunRetrospective,
  RunStrategy,
  StrategicGoal,
  UserPattern,
} from "@auria/contracts";

export interface StrategyContext {
  retrospectives: RunRetrospective[];
  roadmap: StrategicGoal[];
  userPatterns: UserPattern[];
  capabilities: CapabilityEntry[];
}

export interface StrategySelection {
  strategy: RunStrategy;
  focus: string;
  reason: string;
}

const ALL_STRATEGIES: RunStrategy[] = [
  "innovation",
  "deep-improvement",
  "user-driven",
  "gap-filling",
  "integration",
  "resilience",
];

/**
 * Analiza el contexto actual y selecciona la mejor estrategia para el próximo run.
 * Considera: historial de runs, patrones del usuario, gaps conocidos, y diversidad.
 */
export function selectStrategy(ctx: StrategyContext): StrategySelection {
  const recentRetros = ctx.retrospectives.slice(-5);
  const pendingGoals = ctx.roadmap.filter(
    (g) => g.status === "pending" || g.status === "in_progress",
  );
  const unaddressedPatterns = ctx.userPatterns.filter(
    (p) => !p.addressed && p.frequency >= 2,
  );
  const missingCapabilities = ctx.capabilities.filter(
    (c) => c.status === "missing" || c.status === "partial",
  );

  // 1. Si hay quejas/pedidos del usuario sin atender → user-driven
  if (unaddressedPatterns.length > 0) {
    const topPattern = [...unaddressedPatterns].sort(
      (a, b) => b.frequency - a.frequency,
    )[0];
    return {
      strategy: "user-driven",
      focus: topPattern.pattern,
      reason: `El usuario ha mencionado "${topPattern.pattern}" ${topPattern.frequency} veces sin resolver.`,
    };
  }

  // 2. Si hay capacidades faltantes/rotas → gap-filling
  if (missingCapabilities.length > 0) {
    const topGap = missingCapabilities[0];
    return {
      strategy: "gap-filling",
      focus: topGap.name,
      reason: `Capacidad "${topGap.name}" está ${topGap.status}: ${topGap.gaps?.join(", ") || "necesita implementación"}.`,
    };
  }

  // 3. Si los últimos runs tuvieron bajo impacto → cambiar estrategia
  if (recentRetros.length >= 3) {
    const avgImpact =
      recentRetros.reduce((s, r) => s + r.impactScore, 0) /
      recentRetros.length;
    if (avgImpact < 2.5) {
      const recentStrategies = recentRetros.map((r) => r.strategy);
      const rotatable: RunStrategy[] = [
        "innovation",
        "deep-improvement",
        "integration",
        "resilience",
      ];
      const fresh =
        rotatable.find((s) => !recentStrategies.includes(s)) || "innovation";
      return {
        strategy: fresh,
        focus: "Cambio de enfoque necesario",
        reason: `Los últimos ${recentRetros.length} runs tuvieron impacto promedio de ${avgImpact.toFixed(1)}/5. Cambiando a estrategia "${fresh}" para romper el ciclo.`,
      };
    }
  }

  // 4. Si hay objetivos pendientes de alta prioridad → seguirlos
  const criticalGoals = pendingGoals.filter(
    (g) => g.priority === "critical" || g.priority === "high",
  );
  if (criticalGoals.length > 0) {
    const goal = criticalGoals[0];
    return {
      strategy: "deep-improvement",
      focus: goal.title,
      reason: `Objetivo estratégico pendiente: "${goal.title}" (${goal.priority}).`,
    };
  }

  // 5. Diversificar — evitar repetir la misma estrategia
  const lastStrategy =
    recentRetros[recentRetros.length - 1]?.strategy;
  const rotationPool: RunStrategy[] = [
    "innovation",
    "deep-improvement",
    "gap-filling",
    "integration",
  ];
  const nextIdx = lastStrategy
    ? (rotationPool.indexOf(lastStrategy) + 1) % rotationPool.length
    : 0;
  return {
    strategy: rotationPool[nextIdx],
    focus: "Exploración general",
    reason: `Rotación de estrategia para mantener diversidad. Última: "${lastStrategy || "ninguna"}".`,
  };
}

/**
 * Genera directiva corta para inyectar en prompts de codificación.
 */
export function getStrategyDirective(strategy: RunStrategy): string {
  const directives: Record<RunStrategy, string> = {
    innovation:
      "PRIORIZA crear funcionalidades COMPLETAMENTE NUEVAS. Piensa en qué puede hacer un competidor que el sistema no puede. Sé creativo y ambicioso.",
    "deep-improvement":
      "PRIORIZA mejorar features EXISTENTES de forma significativa. Haz que algo que ya funciona sea 10x mejor.",
    "user-driven":
      "PRIORIZA lo que el USUARIO ha pedido explícitamente. Revisa las quejas y sugerencias pendientes y resuélvelas PRIMERO.",
    "gap-filling":
      "PRIORIZA llenar HUECOS en el sistema. Busca servicios incompletos, features a medias, y código que existe pero no está conectado.",
    integration:
      "PRIORIZA CONECTAR componentes existentes entre sí. Haz que los servicios se comuniquen mejor. Elimina silos.",
    resilience:
      "PRIORIZA la ESTABILIDAD. Corrige errores silenciosos, agrega manejo de errores donde falta, haz el sistema más robusto.",
  };
  return directives[strategy];
}

/**
 * Genera contexto estratégico completo para inyectar en prompts de investigación/análisis.
 */
export function buildStrategicContext(
  ctx: StrategyContext & {
    rejectedIdeas: Array<{ idea: string; reason: string; date: string }>;
    hotspots: Record<string, number>;
  },
): string {
  const parts: string[] = [];
  const strategy = selectStrategy(ctx);

  parts.push(
    `## ESTRATEGIA PARA ESTE RUN: ${strategy.strategy.toUpperCase()}`,
  );
  parts.push(`**Enfoque:** ${strategy.focus}`);
  parts.push(`**Razón:** ${strategy.reason}`);
  parts.push("");

  // Roadmap activo
  const activeGoals = ctx.roadmap
    .filter((g) => g.status === "pending" || g.status === "in_progress")
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      return prio[a.priority] - prio[b.priority];
    })
    .slice(0, 10);
  if (activeGoals.length) {
    parts.push("## ROADMAP ACTIVO (objetivos pendientes)");
    for (const g of activeGoals) {
      parts.push(
        `- [${g.priority.toUpperCase()}] **${g.title}** (${g.area}): ${g.description}`,
      );
    }
    parts.push("");
  }

  // Gaps conocidos
  const gaps = ctx.capabilities.filter(
    (c) => c.status === "missing" || c.status === "partial",
  );
  if (gaps.length) {
    parts.push("## GAPS CONOCIDOS (capacidades faltantes o incompletas)");
    for (const g of gaps.slice(0, 8)) {
      parts.push(
        `- **${g.name}** [${g.status}]: ${g.gaps?.join(", ") || g.description}`,
      );
    }
    parts.push("");
  }

  // Lecciones de runs recientes
  const recentLessons = ctx.retrospectives
    .slice(-3)
    .flatMap((r) => r.lessons);
  if (recentLessons.length) {
    parts.push("## LECCIONES APRENDIDAS (de runs recientes)");
    const uniqueLessons = [...new Set(recentLessons)].slice(0, 8);
    for (const l of uniqueLessons) {
      parts.push(`- ${l}`);
    }
    parts.push("");
  }

  // Ideas rechazadas
  if (ctx.rejectedIdeas.length) {
    parts.push("## IDEAS YA RECHAZADAS (NO repetir)");
    for (const idea of ctx.rejectedIdeas.slice(-10)) {
      parts.push(`- "${idea.idea}" — Razón: ${idea.reason}`);
    }
    parts.push("");
  }

  // Patrones del usuario sin resolver
  const unresolved = ctx.userPatterns.filter((p) => !p.addressed);
  if (unresolved.length) {
    parts.push("## PETICIONES DEL USUARIO SIN RESOLVER");
    for (const p of unresolved.slice(0, 5)) {
      parts.push(
        `- [${p.category}] "${p.pattern}" (mencionado ${p.frequency}x, último: ${p.lastSeen})`,
      );
    }
    parts.push("");
  }

  // Score de impacto reciente
  const recentRetros = ctx.retrospectives.slice(-5);
  if (recentRetros.length) {
    const avgImpact =
      recentRetros.reduce((s, r) => s + r.impactScore, 0) /
      recentRetros.length;
    parts.push(
      `## IMPACTO RECIENTE: ${avgImpact.toFixed(1)}/5 (promedio de últimos ${recentRetros.length} runs)`,
    );
    if (avgImpact < 3) {
      parts.push(
        "⚠️ El impacto ha sido bajo. Este run DEBE producir algo que el usuario NOTE y pueda USAR.",
      );
    }
    parts.push("");
  }

  return parts.join("\n");
}
