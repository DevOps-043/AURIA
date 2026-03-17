/**
 * Self-Learning — Patrones de detección y clasificación de mensajes.
 * 50+ regex patterns como datos puros + función de clasificación sin efectos secundarios.
 * Adaptado de autodev-selflearn.ts.
 */
import type { SelfLearnCategory, MicroFixTrigger } from "@auria/contracts";

// ─── Patterns: Quejas del usuario (español) ────────────────────────

const COMPLAINT_PATTERNS: RegExp[] = [
  /no (lo )?hiciste/i,
  /no funciona/i,
  /no sirve/i,
  /sigue (sin|igual|apagado|cerrado)/i,
  /no (se )?descarg[oó]/i,
  /no (se )?abri[oó]/i,
  /no (se )?guard[oó]/i,
  /no (se )?envi[oó]/i,
  /no (se )?cre[oó]/i,
  /no (está|esta) (hecho|listo)/i,
  /no pasó nada/i,
  /no paso nada/i,
  /mentira/i,
  /eso no (es cierto|paso)/i,
  /no (se|lo) ejecut[oó]/i,
  /c[oó]mo vas/i,
  /ya (lo )?hiciste/i,
  /sigues sin/i,
  /no me (pasaste|enviaste|mandaste)/i,
  /lleva (mucho|rato|tiempo)/i,
  /(deja de|para de|no) menti(r|s)/i,
  /pero no/i,
  /se supone que/i,
  /(qué|que) pas[oó] con/i,
  /no (has|haz) hecho nada/i,
];

// ─── Patterns: Sugerencias del usuario ─────────────────────────────

const SUGGESTION_PATTERNS: RegExp[] = [
  /deber[ií]as? (poder|hacer|saber|tener)/i,
  /estar[ií]a (bien|bueno|mejor) (que|si)/i,
  /ser[ií]a (bueno|mejor|útil|genial) (que|si)/i,
  /por qu[eé] no (puedes|haces|tienes)/i,
  /te falta(n)? /i,
  /necesitas (poder|saber|aprender|mejorar)/i,
  /a[gñ]ade|agrega|implementa/i,
  /sugiero que/i,
  /quiero que (puedas|aprendas|mejores)/i,
  /me gustar[ií]a que/i,
  /podr[ií]as/i,
];

// ─── Patterns: Acciones no verificadas ─────────────────────────────

const UNVERIFIED_ACTION_PATTERNS: RegExp[] = [
  /voy a (descargar|crear|abrir|enviar|guardar|mover)/i,
  /ya (estoy|empecé|comencé) a (descargar|crear|abrir)/i,
  /enseguida (empiezo|comienzo|lo hago)/i,
  /te aviso cuando/i,
  /estoy (trabajando|descargando|creando|abriendo)/i,
  /esto puede tardar/i,
  /te mantendré (al tanto|informado)/i,
  /déjame intentar/i,
  /voy a verificar/i,
];

// ─── Keywords que indican que un issue es demasiado grande ─────────

const BIG_ISSUE_KEYWORDS: RegExp[] = [
  /refactor/i,
  /rediseñ/i,
  /arquitectura/i,
  /migra/i,
  /todo el sistema/i,
  /todos los archivos/i,
  /desde cero/i,
  /nueva funcionalidad completa/i,
  /integración con/i,
];

// ─── Classification Result ─────────────────────────────────────────

export interface MessageClassification {
  category: SelfLearnCategory | null;
  matchedPattern: string | null;
  description: string | null;
}

export interface MicroFixCandidate {
  trigger: MicroFixTrigger;
  isMicroFixable: boolean;
  needsFullRun: boolean;
}

// ─── Public Functions ──────────────────────────────────────────────

/**
 * Clasifica un mensaje de usuario buscando quejas o sugerencias.
 * Retorna la primera clasificación encontrada o null si no hay match.
 */
export function classifyUserMessage(message: string): MessageClassification {
  for (const pattern of COMPLAINT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        category: "user_complaint",
        matchedPattern: pattern.source,
        description: `El usuario se quejó de que el sistema no completó una acción correctamente.`,
      };
    }
  }

  for (const pattern of SUGGESTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        category: "user_suggestion",
        matchedPattern: pattern.source,
        description: `El usuario hizo una sugerencia de mejora.`,
      };
    }
  }

  return { category: null, matchedPattern: null, description: null };
}

/**
 * Detecta si una respuesta del sistema contiene promesas de acciones no verificadas.
 */
export function detectUnverifiedActions(response: string): boolean {
  return UNVERIFIED_ACTION_PATTERNS.some((p) => p.test(response));
}

/**
 * Evalúa si un issue detectado puede ser resuelto con un micro-fix
 * o si necesita un full run.
 */
export function evaluateMicroFixCandidate(
  category: SelfLearnCategory,
  description: string,
  userMessage?: string,
  source: string = "system",
): MicroFixCandidate {
  const microFixableCategories: SelfLearnCategory[] = [
    "user_complaint",
    "user_suggestion",
    "tool_failure",
    "computer_use_fail",
  ];

  if (!microFixableCategories.includes(category)) {
    return {
      trigger: {
        category,
        description,
        userMessage,
        source,
        timestamp: new Date().toISOString(),
      },
      isMicroFixable: false,
      needsFullRun: false,
    };
  }

  const msgLen = (userMessage || description).length;
  if (msgLen > 500) {
    return {
      trigger: {
        category,
        description,
        userMessage,
        source,
        timestamp: new Date().toISOString(),
      },
      isMicroFixable: false,
      needsFullRun: true,
    };
  }

  const text = `${description} ${userMessage || ""}`;
  if (BIG_ISSUE_KEYWORDS.some((rx) => rx.test(text))) {
    return {
      trigger: {
        category,
        description,
        userMessage,
        source,
        timestamp: new Date().toISOString(),
      },
      isMicroFixable: false,
      needsFullRun: true,
    };
  }

  return {
    trigger: {
      category,
      description,
      userMessage,
      source,
      timestamp: new Date().toISOString(),
    },
    isMicroFixable: true,
    needsFullRun: false,
  };
}

/**
 * Exporta los patrones crudos para uso en tests o extensión.
 */
export const patterns = {
  complaints: COMPLAINT_PATTERNS,
  suggestions: SUGGESTION_PATTERNS,
  unverifiedActions: UNVERIFIED_ACTION_PATTERNS,
  bigIssueKeywords: BIG_ISSUE_KEYWORDS,
} as const;
