# AutoDev — Documentaci贸n Completa del Sistema de Auto-Programaci贸n Aut贸noma

> **Prop贸sito de este documento:** Documentar absolutamente todo sobre el sistema AutoDev de SofLIA Hub
> antes de migrarlo a un repositorio independiente. Este documento debe ser suficiente para
> reconstruir AutoDev desde cero.
>
> **Fecha:** 2026-03-14
> **Proyecto origen:** SofLIA-HUB (Electron 30.5 + React 18 + TypeScript 5.7)

---

## 脥ndice

1. [Visi贸n General](#1-visi贸n-general)
2. [Arquitectura de Archivos](#2-arquitectura-de-archivos)
3. [Tipos e Interfaces Completos](#3-tipos-e-interfaces-completos)
4. [Configuraci贸n por Defecto](#4-configuraci贸n-por-defecto)
5. [Pipeline Completo de 7 Fases (Full Run)](#5-pipeline-completo-de-7-fases-full-run)
6. [Pipeline Micro-Fix de 4 Fases (Reactive)](#6-pipeline-micro-fix-de-4-fases-reactive)
7. [Prompts Completos de Gemini](#7-prompts-completos-de-gemini)
8. [Memoria Estrat茅gica (Strategic Memory)](#8-memoria-estrat茅gica-strategic-memory)
9. [SelfLearn — Detecci贸n Autom谩tica de Fallos](#9-selflearn--detecci贸n-autom谩tica-de-fallos)
10. [Operaciones Git](#10-operaciones-git)
11. [Integraci贸n GitHub (REST API)](#11-integraci贸n-github-rest-api)
12. [Validaci贸n y Safety Guards](#12-validaci贸n-y-safety-guards)
13. [Web Research y NPM Audit](#13-web-research-y-npm-audit)
14. [Sandbox de Ejecuci贸n](#14-sandbox-de-ejecuci贸n)
15. [IPC Handlers](#15-ipc-handlers)
16. [Componente UI (React)](#16-componente-ui-react)
17. [CLI Standalone](#17-cli-standalone)
18. [Integraci贸n en main.ts](#18-integraci贸n-en-maints)
19. [Eventos del Sistema](#19-eventos-del-sistema)
20. [Persistencia de Datos](#20-persistencia-de-datos)
21. [Dependencias Externas](#21-dependencias-externas)

---

## 1. Visi贸n General

AutoDev es un **sistema multi-agente de auto-programaci贸n aut贸noma** que mejora continuamente el c贸digo de SofLIA Hub sin intervenci贸n humana. Usa Google Gemini AI con function calling para investigar, analizar, planificar, codificar, revisar y publicar mejoras autom谩ticamente.

### Caracter铆sticas Principales

- **7 fases de pipeline completo** con memoria estrat茅gica persistente
- **4 fases de micro-fix reactivo** para correcciones r谩pidas
- **6 agentes especializados** (researcher, coder, reviewer, security, dependencies, tester)
- **Memoria estrat茅gica** que sobrevive entre runs (roadmap, retrospectivas, capacidades)
- **Self-learning** que detecta quejas de usuarios, fallos de herramientas y sugerencias
- **Safety guards** contra phantom imports, c贸digo truncado, rewrites destructivos
- **Notificaciones WhatsApp** del resultado de cada run
- **Standalone CLI** para ejecuci贸n fuera de Electron
- **UI Panel** en React para control y monitoreo

### 3 Modos de Activaci贸n

| Modo | Trigger | Pipeline | Scope | L铆mite Diario |
|------|---------|----------|-------|----------------|
| **Scheduled (Full)** | Cron `0 3 * * *` (3 AM), idle >5min | 7 fases | 500+ l铆neas, 30 archivos | `maxDailyRuns: 3` |
| **Manual (Full)** | WhatsApp `autodev_run_now` o bot贸n UI | Mismo 7 fases | Igual que scheduled | Mismo contador |
| **Micro-Fix (Reactivo)** | SelfLearnService detecta error/sugerencia | 4 fases lightweight | 5 archivos, 200 l铆neas | `maxDailyMicroRuns: 5` |

### Modelos AI Usados

| Agente | Modelo | Prop贸sito |
|--------|--------|-----------|
| Researcher | `gemini-3-flash-preview` | Investigaci贸n web con Google Search grounding |
| Coder | `gemini-3.1-pro-preview-customtools` | An谩lisis de c贸digo + implementaci贸n con function calling |
| Reviewer | `gemini-3-flash-preview` | Self-review + quality check |
| Security | `gemini-3-flash-preview` | An谩lisis de seguridad |
| Dependencies | `gemini-3-flash-preview` | Auditor铆a de dependencias |
| Tester | `gemini-3-flash-preview` | Verificaci贸n de build |

---

## 2. Arquitectura de Archivos

### Archivos del Sistema AutoDev

```
electron/
鈹溾攢鈹? autodev-service.ts          # Orquestador principal (~2400 l铆neas)
鈹?   鈹斺攢 Clase: AutoDevService extends EventEmitter
鈹?   鈹斺攢 Pipeline de 7 fases (full run)
鈹?   鈹斺攢 Pipeline de 4 fases (micro-fix)
鈹?   鈹斺攢 Gesti贸n de configuraci贸n, historial, l铆mites
鈹?
鈹溾攢鈹? autodev-types.ts             # Tipos e interfaces (279 l铆neas)
鈹?   鈹斺攢 AutoDevConfig, AutoDevRun, MicroFixConfig, etc.
鈹?
鈹溾攢鈹? autodev-prompts.ts           # 10 prompts de Gemini (831 l铆neas)
鈹?   鈹斺攢 PRODUCT_VISION, QUALITY_EXEMPLARS
鈹?   鈹斺攢 RESEARCH_GROUNDING_PROMPT, ANALYZE_PROMPT, PLAN_PROMPT
鈹?   鈹斺攢 CODE_PROMPT, REVIEW_PROMPT, SUMMARY_PROMPT
鈹?   鈹斺攢 NPM_ANALYSIS_PROMPT
鈹?   鈹斺攢 MICRO_FIX_ANALYZE_PROMPT, MICRO_FIX_CODE_PROMPT, MICRO_FIX_SUMMARY_PROMPT
鈹?
鈹溾攢鈹? autodev-strategic-memory.ts  # Memoria estrat茅gica persistente (659 l铆neas)
鈹?   鈹斺攢 Clase: StrategicMemoryService
鈹?   鈹斺攢 Roadmap, Capabilities, Retrospectives, UserPatterns
鈹?   鈹斺攢 Strategy selection (6 estrategias)
鈹?
鈹溾攢鈹? autodev-selflearn.ts         # Detecci贸n de fallos y sugerencias (422 l铆neas)
鈹?   鈹斺攢 Clase: SelfLearnService extends EventEmitter
鈹?   鈹斺攢 50+ regex patterns para quejas/sugerencias en espa帽ol
鈹?   鈹斺攢 Clasificaci贸n micro-fix vs full-run
鈹?
鈹溾攢鈹? autodev-git.ts               # Operaciones Git con safety guards (245 l铆neas)
鈹?   鈹斺攢 Clase: AutoDevGit
鈹?   鈹斺攢 Protected branches, execFile (no exec)
鈹?
鈹溾攢鈹? autodev-github.ts            # GitHub REST API para PRs (197 l铆neas)
鈹?   鈹斺攢 createAutonomousPR() via fetch()
鈹?   鈹斺攢 WhatsApp notification queue
鈹?
鈹溾攢鈹? autodev-web.ts               # Web search + npm audit (197 l铆neas)
鈹?   鈹斺攢 webSearch(), readWebpage(), npmAudit(), npmOutdated()
鈹?
鈹溾攢鈹? autodev-sandbox.ts           # Sandbox de ejecuci贸n con Zod (331 l铆neas)
鈹?   鈹斺攢 ToolSandbox.execute(), validateToolInput()
鈹?   鈹斺攢 verifyNpmPackage()
鈹?
鈹溾攢鈹? autodev-validation.ts        # Parsing de errores, phantom imports (233 l铆neas)
鈹?   鈹斺攢 parseBuildErrors(), findPhantomImports(), isCodeComplete()
鈹?   鈹斺攢 Error Memory (loadErrorMemory, saveErrorMemory)
鈹?   鈹斺攢 RESEARCH_TOOLS (function declarations para Gemini)
鈹?   鈹斺攢 Constants: CONFIG_PATH, HISTORY_PATH, etc.
鈹?
鈹斺攢鈹? autodev-handlers.ts          # IPC handlers (61 l铆neas)
    鈹斺攢 9 canales IPC registrados
    鈹斺攢 Event forwarding al renderer

scripts/
鈹斺攢鈹? autodev.ts                   # CLI standalone (50 l铆neas)

src/components/
鈹斺攢鈹? AutoDevPanel.tsx             # Panel UI React

src/hooks/
鈹斺攢鈹? useAutoDevPanel.ts           # Hook del panel
```

### Diagrama de Dependencias entre Archivos

```
autodev-service.ts
  鈹溾攢 imports: autodev-types.ts (tipos)
  鈹溾攢 imports: autodev-prompts.ts (todos los prompts)
  鈹溾攢 imports: autodev-strategic-memory.ts (StrategicMemoryService)
  鈹溾攢 imports: autodev-git.ts (AutoDevGit)
  鈹溾攢 imports: autodev-web.ts (webSearch, readWebpage, npmAudit, npmOutdated)
  鈹溾攢 imports: autodev-validation.ts (parseBuildErrors, findPhantomImports, isCodeComplete, etc.)
  鈹溾攢 imports: autodev-sandbox.ts (verifyNpmPackage)
  鈹斺攢 imports: @google/generative-ai (GoogleGenerativeAI)

autodev-handlers.ts
  鈹溾攢 imports: autodev-service.ts (AutoDevService)
  鈹斺攢 imports: autodev-selflearn.ts (SelfLearnService)

autodev-github.ts
  鈹斺攢 imports: @google/generative-ai (FunctionDeclaration, SchemaType)

main.ts
  鈹溾攢 imports: autodev-service.ts
  鈹溾攢 imports: autodev-handlers.ts
  鈹斺攢 imports: autodev-selflearn.ts
```

---

## 3. Tipos e Interfaces Completos

> **Archivo:** `electron/autodev-types.ts` (279 l铆neas)
> Contenido literal completo:

```typescript
/**
 * AutoDev Types 鈥? Interfaces for the autonomous self-programming system.
 * Multi-agent architecture with parallel execution.
 */

// 鈹€鈹€鈹€ Roles 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type AgentRole =
  | 'research'
  | 'coding'
  | 'review'
  | 'security'
  | 'dependencies'
  | 'testing';

// 鈹€鈹€鈹€ Agent Configuration 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface AgentConfig {
  model: string;
  role: AgentRole;
  description: string;
  concurrency: number; // How many parallel instances
}

// 鈹€鈹€鈹€ MCP Configuration 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AutoDevConfig {
  enabled: boolean;
  cronSchedule: string;
  adaptiveThinking: boolean;

  // 鈹€鈹€鈹€ Multi-agent models 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  agents: {
    researcher: AgentConfig;    // Web research + googleSearch grounding
    coder: AgentConfig;         // Code analysis + implementation
    reviewer: AgentConfig;      // Self-review + quality check
    security: AgentConfig;      // Security-focused analysis
    dependencies: AgentConfig;  // Dependency audit + updates
    tester: AgentConfig;        // Test generation + verification
  };

  // 鈹€鈹€鈹€ Limits 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  maxFilesPerRun: number;
  maxDailyRuns: number;
  maxLinesChanged: number;
  maxResearchQueries: number;
  maxParallelAgents: 1 | 2;    // Total concurrent agents across all types

  // 鈹€鈹€鈹€ API & Integrations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  rateLimitRetryBackoff?: boolean;
  mcpServers?: McpServerConfig[];

  // 鈹€鈹€鈹€ Git/PR 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  targetBranch: string;
  workBranchPrefix: string;
  autoMerge: boolean;
  requireBuildPass: boolean;

  // 鈹€鈹€鈹€ Scope 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  categories: AutoDevCategory[];

  // 鈹€鈹€鈹€ Notifications 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  notifyWhatsApp: boolean;
  notifyPhone: string;

  // 鈹€鈹€鈹€ Micro-Fix (reactive lightweight runs) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  microFix: MicroFixConfig;
}

export type AutoDevCategory =
  | 'security'
  | 'quality'
  | 'performance'
  | 'dependencies'
  | 'tests'
  | 'features';

export type AutoDevRunMode = 'full' | 'micro';

export type AutoDevRunStatus =
  | 'researching'
  | 'analyzing'
  | 'planning'
  | 'coding'
  | 'verifying'
  | 'pushing'
  | 'completed'
  | 'failed'
  | 'aborted';

// 鈹€鈹€鈹€ Agent Task Tracking 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface AgentTask {
  id: string;
  agentRole: AgentRole;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  description: string;
  result?: any;
  error?: string;
}

// 鈹€鈹€鈹€ Orchestrator Task 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface OrchestratorTask {
  id: string;
  agentRole: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: any;
  contextDump: string;
}

// 鈹€鈹€鈹€ Run 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface AutoDevRun {
  id: string;
  mode: AutoDevRunMode;
  startedAt: string;
  completedAt?: string;
  status: AutoDevRunStatus;
  improvements: AutoDevImprovement[];
  researchFindings: ResearchFinding[];
  agentTasks: AgentTask[];     // Track all agent work
  branchName?: string;
  prUrl?: string;
  summary: string;
  error?: string;
  /** For micro runs: the trigger that caused it */
  microTrigger?: MicroFixTrigger;
  /** Estrategia seleccionada por el sistema de memoria estrat茅gica */
  strategy?: string;
  /** Warnings de integraci贸n y otros issues detectados durante el run */
  warnings?: string[];
}

// 鈹€鈹€鈹€ Micro-Fix Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface MicroFixConfig {
  enabled: boolean;
  maxDailyMicroRuns: number;
  debounceMinutes: number;
  maxFiles: number;
  maxLines: number;
  autoTriggerOnComplaint: boolean;
  autoTriggerOnSuggestion: boolean;
  autoTriggerOnToolFailure: boolean;
  /** Minimum idle seconds before auto-triggering (0 = no idle check) */
  minIdleSeconds: number;
}

export interface MicroFixTrigger {
  category: string;
  description: string;
  userMessage?: string;
  source: string;
  timestamp: string;
}

export interface AutoDevImprovement {
  file: string;
  category: AutoDevCategory;
  description: string;
  diff?: string;
  applied: boolean;
  researchSources: string[];
  agentRole: AgentRole;          // Which agent produced this
}

export interface ResearchFinding {
  query: string;
  category: AutoDevCategory;
  findings: string;
  sources: string[];
  actionable: boolean;
  agentRole: AgentRole;          // Which agent found this
}

// 鈹€鈹€鈹€ NPM Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface NpmAuditVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean;
}

export interface NpmOutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
}
```

---

## 4. Configuraci贸n por Defecto

```typescript
export const DEFAULT_MICRO_CONFIG: MicroFixConfig = {
  enabled: true,
  maxDailyMicroRuns: 5,
  debounceMinutes: 3,
  maxFiles: 5,
  maxLines: 200,
  autoTriggerOnComplaint: true,
  autoTriggerOnSuggestion: true,
  autoTriggerOnToolFailure: true,
  minIdleSeconds: 0,
};

export const DEFAULT_AGENTS: AutoDevConfig['agents'] = {
  researcher: {
    model: 'gemini-3-flash-preview',
    role: 'research',
    description: 'Investigador web 鈥? busca CVEs, changelogs, best practices con Google Search grounding',
    concurrency: 3,  // 3 researchers in parallel (security, deps, quality)
  },
  coder: {
    model: 'gemini-3.1-pro-preview-customtools',
    role: 'coding',
    description: 'Programador 鈥? analiza c贸digo, planifica e implementa mejoras con herramientas custom',
    concurrency: 2,  // 2 coders working on different files
  },
  reviewer: {
    model: 'gemini-3-flash-preview',
    role: 'review',
    description: 'Revisor 鈥? verifica diffs, valida calidad, aprueba/rechaza cambios',
    concurrency: 1,
  },
  security: {
    model: 'gemini-3-flash-preview',
    role: 'security',
    description: 'Auditor de seguridad 鈥? busca vulnerabilidades, XSS, injection, OWASP top 10',
    concurrency: 1,
  },
  dependencies: {
    model: 'gemini-3-flash-preview',
    role: 'dependencies',
    description: 'Auditor de dependencias 鈥? analiza npm audit, outdated, breaking changes',
    concurrency: 1,
  },
  tester: {
    model: 'gemini-3-flash-preview',
    role: 'testing',
    description: 'Tester 鈥? verifica que build pasa, genera tests sugeridos, valida cobertura',
    concurrency: 1,
  },
};

export const DEFAULT_CONFIG: AutoDevConfig = {
  enabled: false,
  cronSchedule: '0 3 * * *',          // 3 AM diario
  adaptiveThinking: false,
  agents: { ...DEFAULT_AGENTS },
  maxFilesPerRun: 30,
  maxDailyRuns: 3,
  maxLinesChanged: 2000,
  maxResearchQueries: 30,
  maxParallelAgents: 2,
  rateLimitRetryBackoff: true,
  targetBranch: 'main',
  workBranchPrefix: 'autodev/',
  autoMerge: false,
  requireBuildPass: true,
  categories: ['features', 'security', 'quality', 'performance', 'dependencies', 'tests'],
  notifyWhatsApp: true,
  notifyPhone: '',
  microFix: { ...DEFAULT_MICRO_CONFIG },
};
```

### Rutas de Archivos de Datos

```typescript
// Dentro de app.getPath('userData')/.autodev-data/
CONFIG_PATH    = '<userData>/.autodev-data/autodev-config.json'
HISTORY_PATH   = '<userData>/.autodev-data/autodev-history.json'
ERROR_MEMORY_PATH = '<userData>/.autodev-data/autodev-error-memory.json'
STRATEGIC_MEMORY = '<userData>/autodev-strategic-memory.json'

// En ra铆z del repo
AUTODEV_ISSUES.md    // Issues auto-detectados
AUTODEV_FEEDBACK.md  // Sugerencias de usuarios

// Constantes
MAX_HISTORY_RUNS = 50
IGNORE_DIRS = ['node_modules', 'dist', 'dist-electron', '.git', 'build', 'coverage', 'SofLIA - Extension']
```

---

## 5. Pipeline Completo de 7 Fases (Full Run)

```
Phase 0: Strategic Awareness
  鈹溾攢 StrategicMemoryService.selectStrategy()
  鈹斺攢 Selecciona: innovation | deep-improvement | user-driven | gap-filling | integration | resilience

Phase 1: Parallel Research (5 agentes + npm)
  鈹溾攢 SecurityAgent 鈥? CVEs, OWASP, vulnerability patterns
  鈹溾攢 DependenciesAgent 鈥? Changelog analysis, breaking changes
  鈹溾攢 FeaturesAgent 鈥? Best practices, new patterns
  鈹溾攢 QualityAgent 鈥? Code quality patterns, performance
  鈹溾攢 NpmAudit 鈥? `npm audit --json` + `npm outdated --json`
  鈹斺攢 Todos usan Google Search grounding via Gemini function calling

Phase 1.5: Deep Agentic Research
  鈹溾攢 Gemini coder model con web_search + read_webpage + read_file tools
  鈹溾攢 Multi-turn chat loop (hasta 10 turns)
  鈹斺攢 Capability Gap Analysis (background, non-blocking)

Phase 2: Analysis + Planning
  鈹溾攢 Analyze: Usa coder model con function calling + {STRATEGIC_CONTEXT}
  鈹溾攢 SafetyFilter: Bloquea major version bumps
  鈹溾攢 QualityGate: Elimina planes dominados por dependencias (>50% deps 鈫? remove all)
  鈹溾攢 PlanGate: Enforce >70% feature/quality steps
  鈹斺攢 IntegrationGate: Auto-agrega paso de integraci贸n en main.ts si plan crea archivos nuevos

Phase 3: Parallel Coding (2 coder agents)
  鈹溾攢 Crea work branch: autodev/{timestamp}--{random}
  鈹溾攢 Divide plan en batches (ceil(plan.length / 2))
  鈹溾攢 Ejecuta implementStep() para cada paso con safety guards:
  鈹?   鈹溾攢 Phantom import detector
  鈹?   鈹溾攢 Truncated code detector (unbalanced braces, trailing ...)
  鈹?   鈹溾攢 Destructive rewrite blocker (files shrinking >60%)
  鈹?   鈹斺攢 Blocked files: package.json, package-lock.json, tsconfig.json, vite.config.ts
  鈹斺攢 Requiere al menos 1 improvement aplicada para continuar

Phase 4: Review + Build (hasta 4 retries con auto-fix)
  鈹溾攢 Safety: Verifica estar en work branch (no main/master)
  鈹溾攢 git add -A + verificar l铆neas cambiadas
  鈹溾攢 En PARALELO: selfReview(diff) + verifyBuild(npx tsc --noEmit)
  鈹溾攢 Si falla: parseBuildErrors() + createFixPlan() + implementStep() 鈫? retry
  鈹溾攢 verifyIntegration(): detecta archivos hu茅rfanos (no importados)
  鈹?   鈹溾攢 tools/dynamic/: valida ToolSchema en vez de imports
  鈹?   鈹斺攢 Otros: verifica import en electron/ o src/
  鈹斺攢 Si 4 retries fallan: run.status = 'failed', persistFailedBranch()

Phase 5: Commit + Push + PR
  鈹溾攢 git commit -m "[AutoDev] {message}"
  鈹溾攢 git push -u origin {branchName}
  鈹溾攢 gh pr create --title --body --base
  鈹溾攢 git checkout main (volver a rama principal)
  鈹斺攢 generateSummary() via Gemini

Phase 6: Retrospective
  鈹溾攢 Track hotspots (archivos tocados frecuentemente)
  鈹溾攢 Gemini eval煤a su propio trabajo (impactScore 1-5)
  鈹溾攢 Records: lessons learned, mistakes, suggested goals
  鈹斺攢 strategicMemory.processRetrospectiveResponse() actualiza roadmap + capabilities
```

### M茅todo Entry Point: `runNow()`

```typescript
async runNow(): Promise<AutoDevRun> {
  // Pre-flight checks:
  // - API key set
  // - Not already running
  // - Daily limit not exceeded
  // - Reset daily counters if new day

  const run: AutoDevRun = {
    id: `run_${Date.now()}`,
    mode: 'full',
    startedAt: new Date().toISOString(),
    status: 'researching',
    improvements: [],
    researchFindings: [],
    agentTasks: [],
    summary: '',
  };

  this.currentRun = run;
  this.abortController = new AbortController();
  this.emit('run-started', run);

  try {
    await this.executeRun(run);
  } finally {
    this.currentRun = null;
    this.abortController = null;
    this.todayRunCount++;
    this.history.push(run);
    this.saveHistory();
    this.emit('run-completed', run);

    // WhatsApp notification
    if (this.config.notifyWhatsApp && this.config.notifyPhone && run.summary) {
      this.emit('notify-whatsapp', { phone: this.config.notifyPhone, message: run.summary });
    }
  }

  return run;
}
```

### M茅todo `implementStep()` — L贸gica de Codificaci贸n

Maneja 3 tipos de acciones:

**1. ACTION: COMMAND (npm install, etc.)**
- Pre-valida paquetes npm contra lista de bloqueados: `['electron', 'react', 'react-dom', 'vite', 'typescript', 'sharp']`
- Verifica existencia en NPM registry via `verifyNpmPackage()`
- Ejecuta con 2 retries + AI auto-fix si falla

**2. ACTION: DELETE**
- Elimina archivo si existe
- Deletions no cuentan como improvements (`wasDeleted: true`)

**3. ACTION: CREATE / MODIFY**
- Security check: filepath debe estar dentro del repoPath
- Blocked files: `package.json, package-lock.json, tsconfig.json, vite.config.ts`
- Lee c贸digo actual del archivo
- Env铆a CODE_PROMPT a Gemini coder model con function calling
- Rate limiting: 45s cool-down en HTTP 429/503, fallback a flash model
- **4 Safety Guards** aplicados al resultado:
  1. `findPhantomImports()` 鈫? bloquea si hay imports de archivos inexistentes
  2. `isCodeComplete()` 鈫? bloquea si hay braces desbalanceados o trailing `...`
  3. Destructive rewrite check 鈫? bloquea si archivo se reduce >60%
  4. Major version bump check para package.json
- Escribe archivo si pasa todos los guards

---

## 6. Pipeline Micro-Fix de 4 Fases (Reactive)

### Queueing y Debounce

```typescript
queueMicroFix(trigger: MicroFixTrigger): void {
  // Checks:
  // - microFix.enabled
  // - API key set
  // - Category auto-trigger enabled (complaint/suggestion/tool_failure)
  // - No full run or micro run in progress
  // - Daily limit not exceeded

  this.microFixQueue.push(trigger);

  // Clear existing debounce timer
  if (this.microFixDebounceTimer) clearTimeout(this.microFixDebounceTimer);

  // Set new timer: wait microFix.debounceMinutes (default 3 min)
  this.microFixDebounceTimer = setTimeout(() => {
    this.executeMicroFix();
  }, this.config.microFix.debounceMinutes * 60 * 1000);
}
```

### 4 Fases

```
Phase 1: Analyze Trigger
  鈹溾攢 Prep trigger context (todos los triggers en el queue)
  鈹溾攢 Lee archivos fuente (primeros 30 archivos, max 100K chars)
  鈹溾攢 MICRO_FIX_ANALYZE_PROMPT 鈫? Gemini coder model
  鈹溾攢 Si analysis.needs_full_run = true 鈫? skip, marcar como "requires full run"
  鈹斺攢 Extrae plan (max 5 archivos)

Phase 2: Code Fix
  鈹溾攢 Crea micro branch: autodev/micro-{timestamp}
  鈹溾攢 implementStep() para cada paso (mismos safety guards que full run)
  鈹斺攢 Requiere al menos 1 improvement aplicada

Phase 3: Build Verify
  鈹溾攢 Switch a work branch si necesario
  鈹溾攢 git add -A
  鈹溾攢 Verifica l铆mite de l铆neas (microFix.maxLines = 200)
  鈹溾攢 npx tsc --noEmit
  鈹斺攢 1 retry con auto-fix si falla (max 5 errores para auto-fix)

Phase 4: Commit + Push + PR
  鈹溾攢 git commit -m "[AutoDev Micro] {description}"
  鈹溾攢 git push -u origin {branchName}
  鈹溾攢 gh pr create --title "馃敡 [Micro-Fix] {description}"
  鈹溾攢 MICRO_FIX_SUMMARY_PROMPT 鈫? resumen corto (500 chars)
  鈹斺攢 Notifica por WhatsApp
```

---

## 7. Prompts Completos de Gemini

> **Archivo:** `electron/autodev-prompts.ts` (831 l铆neas)
> A continuaci贸n se incluye el contenido LITERAL de cada prompt.

### 7.1 PRODUCT_VISION

Inyectado en TODOS los prompts para contexto estrat茅gico:

```
## 馃幆 VISI脫N DEL PRODUCTO 鈥? SofLIA Hub

SofLIA es un **SISTEMA OPERATIVO DE IA** para profesionales y empresas hispanohablantes.
NO es un chatbot. NO es solo un editor de c贸digo. Es un **agente aut贸nomo completo** que:

1. **CONTROLA el computador del usuario** 鈥? mouse, teclado, ventanas, archivos, apps
2. **SE COMUNICA por WhatsApp** 鈥? el usuario controla todo remotamente desde su tel茅fono
3. **SE AUTO-PROGRAMA** 鈥? AutoDev mejora SofLIA continuamente sin intervenci贸n humana
4. **GESTIONA el negocio** 鈥? CRM, proyectos, workflows, calendario, email, reuniones

### Lo que el usuario ESPERA de cada run de AutoDev:
- Funcionalidades NUEVAS que ampl铆en las capacidades del sistema
- Herramientas WhatsApp nuevas que le den m谩s control remoto
- Automatizaciones inteligentes que le ahorren tiempo
- Mejoras en la experiencia de uso (UX del agente, no solo del c贸digo)

### Lo que el usuario NO quiere ver:
- Actualizaciones de dependencias como mejora principal
- Refactoring cosm茅tico sin impacto funcional
- Mejoras de "calidad de c贸digo" que no cambian comportamiento
- Runs que solo hacen 1-2 cambios peque帽os

### REGLA DE ORO:
Cada run de AutoDev debe producir al menos UNA funcionalidad nueva que el usuario
pueda USAR y NOTAR. Si despu茅s de un run el usuario no puede hacer algo nuevo
que antes no pod铆a, el run fue un desperdicio.

### 脕reas de M脕XIMO impacto (en orden de prioridad):
1. **Nuevas herramientas WhatsApp** 鈥? comandos que el usuario pueda enviar desde su tel茅fono
2. **Automatizaciones de sistema** 鈥? organizar archivos, limpiar disco, monitorear procesos
3. **Computer Use avanzado** 鈥? flujos de automatizaci贸n visual, RPA, control de apps
4. **Informes y alertas proactivas** 鈥? el sistema informa sin que se lo pidan
5. **Integraciones nuevas** 鈥? APIs externas, servicios cloud, datos en tiempo real
6. **AutoDev self-evolution** 鈥? hacer que AutoDev sea m谩s inteligente y aut贸nomo
```

### 7.2 QUALITY_EXEMPLARS

Ejemplos de implementaciones de calidad como referencia:

```
## 馃搼 EJEMPLOS DE IMPLEMENTACIONES DE CALIDAD

Estos ejemplos muestran el NIVEL de calidad y completitud que se espera de cada funcionalidad.
NO copies estos ejemplos 鈥? 煤salos como referencia de estilo y profundidad.

### Ejemplo 1: Nueva herramienta WhatsApp (patr贸n completo)
Una herramienta WhatsApp COMPLETA incluye:
// 1. Declaraci贸n de la funci贸n (en whatsapp-agent.ts 鈫? TOOL_DECLARATIONS)
{
  name: 'system_health_report',
  description: 'Genera un reporte completo del estado del sistema...',
  parameters: { type: SchemaType.OBJECT, properties: { ... } }
}

// 2. Handler completo con manejo de errores
case 'system_health_report': { ... }

### Ejemplo 2: Servicio de sistema (patr贸n EventEmitter)
class NombreService extends EventEmitter {
  async init(): Promise<void> { /* carga config, conecta DB */ }
  async start(): Promise<void> { /* inicia polling/listeners */ }
  async stop(): Promise<void> { clearInterval(this.intervalId); }
  getStatus(): Status { /* retorna estado actual */ }
  getConfig(): Config { return this.config; }
}

### Ejemplo 3: IPC completo (service 鈫? handler 鈫? preload 鈫? renderer)
ipcMain.handle('nombre:accion', async (_e, args) => {
  try {
    const result = await service.hacerAlgo(args);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

### 鈿狅笍 Lo que NUNCA se debe hacer:
- Funciones vac铆as con // TODO
- Handlers sin manejo de errores
- Servicios sin init()/start()/stop()
- Herramientas WhatsApp sin descripci贸n
- Imports de m贸dulos que no existen
```

### 7.3 RESEARCH_GROUNDING_PROMPT

Prompt completo para agentes de investigaci贸n con Google Search grounding. Incluye:
- Visi贸n del producto inyectada
- Capacidades actuales de SofLIA
- Lista de dependencias `{DEPENDENCIES_LIST}`
- Categor铆as a investigar `{CATEGORIES}`
- **Regla absoluta: NO DEPENDENCY HUNTING**
- 5 categor铆as de investigaci贸n (WhatsApp tools, automatizaci贸n, Computer Use, inteligencia del agente, integraciones)
- Output JSON con: findings[], cada uno con category, query, findings, sources, priority, actionable, suggestedAction
- M铆nimo 6 findings de categor铆a "features"
- M谩ximo 2 findings de no-features

### 7.4 ANALYZE_PROMPT

Prompt para an谩lisis de mejoras a implementar. Incluye:
- PRODUCT_VISION + QUALITY_EXEMPLARS inyectados
- `{STRATEGIC_CONTEXT}` de memoria estrat茅gica
- `{RESEARCH_FINDINGS}`, `{NPM_AUDIT}`, `{NPM_OUTDATED}`, `{SOURCE_CODE}`
- `{CATEGORIES}`, `{ERROR_MEMORY}`, `{RUN_HISTORY}`
- Herramientas disponibles: web_search, read_webpage, read_file
- **Filtro de calidad**: Rechaza actualizaciones de dependencias, refactoring, logging, types
- **Composici贸n obligatoria**: M铆nimo 70% features, m谩ximo 15% quality/performance, 0% dependencies
- Output JSON: improvements[] con file, category, description, userInteraction, priority, estimatedLines

### 7.5 PLAN_PROMPT

Prompt para planificaci贸n de implementaci贸n:
- PRODUCT_VISION + `{STRATEGIC_CONTEXT}`
- `{IMPROVEMENTS}`, `{RESEARCH_CONTEXT}`, `{ERROR_MEMORY}`
- **Regla cr铆tica de integraci贸n**: Si crea archivo nuevo 鈫? DEBE incluir paso de modify main.ts/whatsapp-agent.ts
- **Composici贸n**: M铆nimo 70% features, m谩ximo 2 pasos "command", 0 pasos "dependencies"
- Output JSON: plan[] con step, file, action, category, description, command, details, source, estimatedLines

### 7.6 CODE_PROMPT

Prompt para generaci贸n de c贸digo:
- PRODUCT_VISION + QUALITY_EXEMPLARS + `{STRATEGY_DIRECTIVE}`
- `{PLAN_STEP}`, `{FILE_PATH}`, `{CURRENT_CODE}`, `{RESEARCH_CONTEXT}`, `{LESSONS_LEARNED}`
- Patrones arquitect贸nicos: WhatsApp tools, servicios EventEmitter, IPC
- **Separaci贸n estricta Main Process vs Renderer**
- **Reglas absolutas**: No phantom imports, c贸digo completo (nunca truncar), preservar tama帽o 卤40%
- Output JSON: { modifiedCode, changesDescription, sourcesConsulted, linesAdded }

### 7.7 REVIEW_PROMPT

Prompt para self-review antes de crear PR:
- `{DIFF}`, `{IMPROVEMENTS_APPLIED}`, `{RESEARCH_SOURCES}`
- **Solo 8 criterios de rechazo**:
  1. Errores de sintaxis
  2. Funcionalidad importante eliminada sin reemplazo
  3. Vulnerabilidad de seguridad (SQL injection, XSS, secrets)
  4. Package.json major version bump
  5. C贸digo no compila (phantom imports, tipos incorrectos)
  6. Imports con rutas que NO existen
  7. Violaci贸n de arquitectura Electron (ipcRenderer en main, fs en renderer)
  8. C贸digo hu茅rfano (archivo nuevo que nadie importa)
- **Bias de aprobaci贸n**: "Ante la duda, APRUEBA"
- Output JSON: { decision: 'approve'|'reject', confidence, issues[], summary }

### 7.8 SUMMARY_PROMPT

Genera informe completo para WhatsApp:
- `{RUN_INFO}`, `{IMPROVEMENTS}`, `{RESEARCH_FINDINGS}`
- M谩ximo 3000 caracteres
- 4 secciones: Resumen ejecutivo, Funcionalidades implementadas, Estado del sistema, Pr贸ximos pasos
- Emojis: 馃 IA, 馃敡 herramientas, 鉁? quality, 馃敀 security, 馃摫 WhatsApp, 馃枼锔? computer use

### 7.9 NPM_ANALYSIS_PROMPT

An谩lisis de npm audit + npm outdated:
- Prioriza: critical > high > moderate
- Detecta breaking changes
- Output JSON: { securityActions[], updateActions[] }

### 7.10 MICRO_FIX_ANALYZE_PROMPT (Completo)

```
Eres un agente de micro-correcciones de SofLIA Hub.
Tu trabajo es analizar un problema espec铆fico reportado por el usuario o detectado por el sistema
y generar un plan de correcci贸n M脥NIMO y PRECISO.

## REGLAS CR脥TICAS

1. SOLO corrige el problema reportado 鈥? NO hagas mejoras adicionales ni refactoring
2. M谩ximo 5 archivos modificados
3. M谩ximo 200 l铆neas cambiadas en total
4. NO toques package.json (no instales dependencias nuevas)
5. NO hagas cambios de arquitectura
6. Si el problema requiere cambios grandes 鈫? responde con "needs_full_run": true
7. Prioriza: correcci贸n funcional > calidad de c贸digo > estilo

## CONTEXTO DEL PROBLEMA

{TRIGGER_CONTEXT}

## C脫DIGO FUENTE RELEVANTE

{SOURCE_CODE}

## ISSUES PENDIENTES RELACIONADOS

{RELATED_ISSUES}

## RESPUESTA

Responde SOLO JSON:
{
  "needs_full_run": false,
  "analysis": "qu茅 causa el problema y c贸mo corregirlo",
  "plan": [
    {
      "step": 1,
      "file": "ruta/archivo.ts",
      "action": "modify",
      "description": "qu茅 cambiar exactamente",
      "estimated_lines": 10
    }
  ],
  "total_estimated_lines": 10,
  "risk_level": "low|medium|high"
}
```

### 7.11 MICRO_FIX_CODE_PROMPT (Completo)

```
Eres un agente programador de micro-correcciones de SofLIA Hub.
Implementa EXACTAMENTE el plan dado. No hagas m谩s cambios de los necesarios.

## REGLAS

1. Solo modifica lo que el plan indica 鈥? nada m谩s
2. Mant茅n el estilo del c贸digo existente
3. No agregues imports innecesarios
4. No agregues comentarios extras ni docstrings
5. No cambies indentaci贸n ni formato de c贸digo que no est谩s modificando
6. Si necesitas informaci贸n de un archivo, usa la herramienta read_file
7. Si necesitas buscar algo en el proyecto, usa web_search solo para documentaci贸n externa

## PLAN DE CORRECCI脫N

{FIX_PLAN}

## C脫DIGO FUENTE DEL ARCHIVO

{FILE_CONTENT}

Implementa los cambios. Devuelve el archivo completo con los cambios aplicados.
```

### 7.12 MICRO_FIX_SUMMARY_PROMPT (Completo)

```
Resume esta micro-correcci贸n de SofLIA en m谩ximo 500 caracteres para WhatsApp.
Formato: emoji + qu茅 se corrigi贸 + archivo(s) modificado(s).
Ejemplo: "馃敡 Corregido: error de tipo en calendar-service.ts 鈥? el m茅todo getEvents ahora maneja correctamente conexiones nulas."

Cambios realizados:
{CHANGES}

Problema original:
{TRIGGER}
```

---

## 8. Memoria Estrat茅gica (Strategic Memory)

> **Archivo:** `electron/autodev-strategic-memory.ts` (659 l铆neas)

### Prop贸sito

Sistema de "conciencia" persistente que sobrevive entre runs. Mantiene un modelo mental del proyecto.

### Archivo de Persistencia

`app.getPath('userData')/autodev-strategic-memory.json`

### Estructura de Datos

```typescript
interface StrategicMemory {
  version: number;
  lastUpdated: string;
  roadmap: StrategicGoal[];           // Objetivos estrat茅gicos
  capabilities: CapabilityEntry[];     // Inventario de capacidades
  retrospectives: RunRetrospective[];  // Evaluaciones de runs pasados (max 30)
  userPatterns: UserPattern[];         // Quejas/sugerencias del usuario
  rejectedIdeas: Array<{              // Ideas descartadas (max 50)
    idea: string;
    reason: string;
    date: string;
  }>;
  nextRunStrategy?: {                 // Estrategia pre-seleccionada para el pr贸ximo run
    strategy: RunStrategy;
    focus: string;
    reason: string;
  };
  hotspots: Record<string, number>;   // Archivos tocados con frecuencia
}

type RunStrategy =
  | 'innovation'        // Crear capacidades completamente nuevas
  | 'deep-improvement'  // Mejorar significativamente features existentes
  | 'user-driven'       // Enfocarse en lo que el usuario ha pedido
  | 'gap-filling'       // Llenar huecos detectados en el sistema
  | 'integration'       // Conectar componentes desconectados
  | 'resilience';       // Mejorar estabilidad y manejo de errores

interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  createdAt: string;
  completedAt?: string;
  relatedRuns: string[];
  area: 'whatsapp' | 'automation' | 'computer-use' | 'integrations' | 'infrastructure' | 'ux' | 'security' | 'autodev';
}

interface CapabilityEntry {
  name: string;
  description: string;
  status: 'functional' | 'partial' | 'broken' | 'missing';
  files: string[];
  lastVerified: string;
  gaps?: string[];
}

interface RunRetrospective {
  runId: string;
  date: string;
  strategy: RunStrategy;
  intent: string;           // Qu茅 se intent贸 hacer
  outcome: string;          // Qu茅 se logr贸 realmente
  impactScore: 1 | 2 | 3 | 4 | 5;
  lessons: string[];
  mistakes: string[];
  orphanedFiles: string[];
  realImprovementsCount: number;
  durationMinutes: number;
}

interface UserPattern {
  pattern: string;
  frequency: number;
  lastSeen: string;
  category: 'complaint' | 'request' | 'suggestion' | 'praise';
  addressed: boolean;
}
```

### L贸gica de Selecci贸n de Estrategia

```typescript
selectStrategy(): { strategy: RunStrategy; focus: string; reason: string } {
  // PRIORIDAD 1: Quejas/pedidos del usuario sin atender (frequency >= 2)
  if (unaddressedPatterns.length > 0) {
    return { strategy: 'user-driven', focus: topPattern.pattern, reason: `...${frequency} veces...` };
  }

  // PRIORIDAD 2: Capacidades faltantes/rotas
  if (missingCapabilities.length > 0) {
    return { strategy: 'gap-filling', focus: topGap.name, reason: `...${status}...` };
  }

  // PRIORIDAD 3: 脷ltimos runs tuvieron bajo impacto (avg < 2.5/5)
  if (recentRetros.length >= 3 && avgImpact < 2.5) {
    // Cambiar a estrategia no usada recientemente
    const fresh = unusedStrategies.find(s => !recentStrategies.includes(s)) || 'innovation';
    return { strategy: fresh, focus: 'Cambio de enfoque necesario', reason: `...impacto ${avg}/5...` };
  }

  // PRIORIDAD 4: Objetivos pendientes de alta prioridad
  if (criticalGoals.length > 0) {
    return { strategy: 'deep-improvement', focus: goal.title, reason: `...${priority}...` };
  }

  // PRIORIDAD 5: Diversificar (rotaci贸n de estrategias)
  const strategies = ['innovation', 'deep-improvement', 'gap-filling', 'integration'];
  const nextIdx = (strategies.indexOf(lastStrategy) + 1) % strategies.length;
  return { strategy: strategies[nextIdx], focus: 'Exploraci贸n general', reason: '...' };
}
```

### getStrategicContext() 鈥? Inyectado en Prompts

Genera markdown con:
- Estrategia actual y enfoque
- Roadmap activo (top 10 goals, sorted by priority)
- Gaps conocidos (capacidades missing/partial)
- Lecciones aprendidas de 煤ltimos 3 runs
- Ideas rechazadas (no repetir)
- Peticiones del usuario sin resolver
- Score de impacto reciente (鈿狅笍 si < 3/5)

### getStrategyDirective() 鈥? Inyectado en CODE_PROMPT

```typescript
const directives: Record<RunStrategy, string> = {
  'innovation': 'PRIORIZA crear funcionalidades COMPLETAMENTE NUEVAS...',
  'deep-improvement': 'PRIORIZA mejorar features EXISTENTES de forma significativa...',
  'user-driven': 'PRIORIZA lo que el USUARIO ha pedido expl铆citamente...',
  'gap-filling': 'PRIORIZA llenar HUECOS en el sistema...',
  'integration': 'PRIORIZA CONECTAR componentes existentes entre s铆...',
  'resilience': 'PRIORIZA la ESTABILIDAD...',
};
```

### Prompt de Retrospectiva

Generado por `getRetrospectivePrompt()`, pide a Gemini evaluar:
1. **impactScore** (1-5): 驴El usuario puede hacer algo NUEVO?
2. **outcome**: Resumen honesto
3. **lessons**: Lecciones aprendidas
4. **mistakes**: Errores cometidos
5. **suggestedGoals**: Objetivos nuevos para el roadmap
6. **suggestedCapabilities**: Capacidades detectadas { name, status, files, gaps }
7. **nextStrategy**: Estrategia sugerida para el siguiente run

### M茅todos P煤blicos del StrategicMemoryService

```typescript
class StrategicMemoryService {
  // Selecci贸n de estrategia
  selectStrategy(): { strategy, focus, reason }
  getCurrentStrategy(): RunStrategy
  clearNextStrategy(): void

  // Contexto para prompts
  getStrategicContext(): string
  getStrategyDirective(): string
  getCapabilityAnalysisPrompt(sourceFiles): string
  getRetrospectivePrompt(runData): string

  // Retrospectivas
  recordRetrospective(retro: RunRetrospective): void
  processRetrospectiveResponse(runId, strategy, durationMinutes, response): void
  getRecentRetrospectives(count?): RunRetrospective[]
  getAverageImpact(lastN?): number

  // Patrones del usuario
  trackUserPattern(pattern, category): void
  markPatternAddressed(pattern): void

  // Roadmap
  addGoal(goal): void
  completeGoal(goalId, runId): void
  getActiveGoals(): StrategicGoal[]

  // Ideas rechazadas
  rejectIdea(idea, reason): void

  // Hotspots
  trackHotspot(file): void
  getOverworkedFiles(threshold?): string[]

  // General
  getMemory(): StrategicMemory
}
```

---

## 9. SelfLearn 鈥? Detecci贸n Autom谩tica de Fallos

> **Archivo:** `electron/autodev-selflearn.ts` (422 l铆neas)

### Prop贸sito

Detecta fallos, limitaciones y feedback del usuario en tiempo real. Escribe a `AUTODEV_ISSUES.md` y `AUTODEV_FEEDBACK.md`. Emite eventos `micro-fix-candidate` para activar micro-fixes autom谩ticos.

### Categor铆as de Detecci贸n

```typescript
type SelfLearnCategory =
  | 'user_complaint'      // Usuario dice que SofLIA fall贸
  | 'user_suggestion'     // Usuario sugiere mejora
  | 'tool_failure'        // Herramienta retorn贸 error
  | 'computer_use_fail'   // Computer Use no logr贸 objetivo
  | 'unverified_action'   // SofLIA dijo que har铆a algo pero quiz谩s no lo hizo
  | 'api_limitation'      // API no configurada o no disponible
  | 'hallucination';      // SofLIA afirm贸 hacer algo que no puede
```

### Patrones de Detecci贸n de Quejas (50+ regex en espa帽ol)

```typescript
const COMPLAINT_PATTERNS = [
  /no (lo )?hiciste/i,
  /no funciona/i,
  /no sirve/i,
  /sigue (sin|igual|apagado|cerrado)/i,
  /no (se )?descarg[o贸]/i,
  /no (se )?abri[o贸]/i,
  /no (se )?guard[o贸]/i,
  /no (se )?envi[o贸]/i,
  /no (se )?cre[o贸]/i,
  /no (est谩|esta) (hecho|listo)/i,
  /no pas贸 nada/i,
  /no paso nada/i,
  /mentira/i,
  /eso no (es cierto|paso)/i,
  /no (se|lo) ejecut[o贸]/i,
  /c[o贸]mo vas/i,                    // "c贸mo vas?" implies no delivery
  /ya (lo )?hiciste/i,
  /sigues sin/i,
  /no me (pasaste|enviaste|mandaste)/i,
  /lleva (mucho|rato|tiempo)/i,
  /(deja de|para de|no) menti(r|s)/i,
  /pero no/i,
  /se supone que/i,
  /(qu茅|que) pas[o贸] con/i,
  /no (has|haz) hecho nada/i,
];
```

### Patrones de Detecci贸n de Sugerencias

```typescript
const SUGGESTION_PATTERNS = [
  /deber[铆i]as? (poder|hacer|saber|tener)/i,
  /estar[铆i]a (bien|bueno|mejor) (que|si)/i,
  /ser[铆i]a (bueno|mejor|煤til|genial) (que|si)/i,
  /por qu[e茅] no (puedes|haces|tienes)/i,
  /te falta(n)? /i,
  /necesitas (poder|saber|aprender|mejorar)/i,
  /a[g帽]ade|agrega|implementa/i,
  /sugiero que/i,
  /quiero que (puedas|aprendas|mejores)/i,
  /me gustar[铆i]a que/i,
  /podr[铆i]as/i,
];
```

### Patrones de Acciones No Verificadas

```typescript
const UNVERIFIED_ACTION_PATTERNS = [
  /voy a (descargar|crear|abrir|enviar|guardar|mover)/i,
  /ya (estoy|empec茅|comenc茅) a (descargar|crear|abrir)/i,
  /enseguida (empiezo|comienzo|lo hago)/i,
  /te aviso cuando/i,
  /estoy (trabajando|descargando|creando|abriendo)/i,
  /esto puede tardar/i,
  /te mantendr茅 (al tanto|informado)/i,
  /d茅jame intentar/i,
  /voy a verificar/i,
];
```

### API P煤blica

```typescript
class SelfLearnService extends EventEmitter {
  // Analizar mensajes de usuario
  analyzeUserMessage(userMessage: string, source: 'whatsapp' | 'chat', context?: { jid?, senderNumber? }): void

  // Rastrear respuestas de SofLIA para correlaci贸n futura
  trackSofLIAResponse(jid: string, response: string): void

  // Registrar fallos de herramientas
  logToolFailure(toolName: string, args: Record<string, any>, error: string, source?: string): void

  // Registrar fallos de Computer Use
  logComputerUseFailure(task: string, error: string): void

  // Registrar limitaciones de API
  logAPILimitation(service: string, error: string): void

  // Registrar sugerencia directa
  logUserSuggestion(suggestion: string, source: 'whatsapp' | 'chat'): void

  // Obtener contexto completo para agentes de AutoDev
  getFullContext(): string
}
```

### Clasificaci贸n Micro-Fix vs Full Run

```typescript
private classifyAndEmit(category, description, userMessage?, source?): void {
  // Micro-fixable: user_complaint, user_suggestion, tool_failure, computer_use_fail
  // NOT micro-fixable: unverified_action, api_limitation, hallucination

  // Skip si mensaje > 500 chars (demasiado complejo)
  // Skip si contiene keywords: refactor, redise帽, arquitectura, migra, todo el sistema,
  //   todos los archivos, desde cero, nueva funcionalidad completa, integraci贸n con

  // Si pasa los checks: emit('micro-fix-candidate', trigger)
}
```

### Formato de Archivos de Output

```markdown
# 馃 AutoDev 鈥? Issues & Self-Diagnosis Log

> Este archivo es generado autom谩ticamente por el sistema de auto-aprendizaje de SofLIA.
> AutoDev usa este archivo como contexto para priorizar mejoras.
> **No borres este archivo** 鈥? las entradas se marcar谩n como resueltas cuando se corrijan.

---

## 鉂? [馃棧锔? QUEJA DE USUARIO] 鈥? 2026-03-14

- **Timestamp**: 2026-03-14T10:30:00.000Z
- **Fuente**: whatsapp
- **Estado**: 馃斀 PENDIENTE

### Descripci贸n

El usuario se quej贸 de que SofLIA no complet贸 una acci贸n correctamente.

### Mensaje del usuario

> no funciona el calendario...

### Contexto

```
Patr贸n detectado: /no funciona/i
```

---
```

Los archivos se recortan a 200 entradas m谩ximas (mantiene 煤ltimas 180).

---

## 10. Operaciones Git

> **Archivo:** `electron/autodev-git.ts` (245 l铆neas)

### Principio de Dise帽o

Todas las operaciones de escritura est谩n protegidas contra branches protegidos (main/master). Usa `execFile` (no `exec`) para prevenir shell injection.

### Clase AutoDevGit

```typescript
class AutoDevGit {
  private repoPath: string;
  private PROTECTED_BRANCHES = ['main', 'master'];

  constructor(repoPath: string)

  // Seguridad
  init(taskId: string): Promise<void>               // Auto-switch a work branch si en protected
  private assertNotProtected(): Promise<void>        // Throw si en branch protegido

  // Solo lectura
  getCurrentBranch(): Promise<string>                // git rev-parse --abbrev-ref HEAD
  getRepoRoot(): Promise<string>                     // git rev-parse --show-toplevel
  getDiff(): Promise<string>                         // git diff --cached --stat
  getFullDiff(): Promise<string>                     // git diff --cached
  getDiffLineCount(): Promise<number>                // Parsed de --shortstat (excluye package-lock.json, yarn.lock)
  hasUncommittedChanges(): Promise<boolean>          // git status --porcelain
  fetchPRHistory(): Promise<Array<{number, title, state, url}>>  // gh pr list --json

  // Escritura (todas con assertNotProtected)
  createWorkBranch(name: string, baseBranch?: string): Promise<string>
    // 1. Switch a baseBranch (stash si hay cambios)
    // 2. git pull origin baseBranch --ff-only
    // 3. Delete branch si ya existe
    // 4. git checkout -b branchName (con fallback timestamp suffix)
    // Retorna: nombre final del branch

  stageFiles(files: string[]): Promise<void>         // git add ...files
  stageAll(): Promise<void>                          // git add -A (doble check de branch)

  commitChanges(message: string): Promise<string>
    // Prefija "[AutoDev]" si no lo tiene
    // Triple check de branch protegido
    // Retorna: short hash

  pushBranch(branchName: string): Promise<void>
    // git push -u origin branchName
    // Rechaza si branchName est谩 en PROTECTED_BRANCHES

  createPR(title: string, body: string, baseBranch: string): Promise<string>
    // gh pr create --title --body --base
    // Prefija "[AutoDev]" al t铆tulo
    // Retorna: PR URL

  switchBranch(name: string): Promise<void>
  exec(subcommand: string, args?: string[]): Promise<string>  // Arbitrary git subcommand

  cleanupBranch(branchName: string): Promise<void>
    // git reset --hard HEAD + git clean -fd + git checkout main + git branch -D
    // Skip si es branch protegido

  // Validaci贸n
  isGhAuthenticated(): Promise<boolean>              // gh auth status
  hasRemote(): Promise<boolean>                      // git remote -v (busca 'origin')
}
```

### Timeouts y Buffers

- Todas las operaciones: timeout 60 segundos, maxBuffer 10MB
- Usa `execFile` (no `exec`) para seguridad

---

## 11. Integraci贸n GitHub (REST API)

> **Archivo:** `electron/autodev-github.ts` (197 l铆neas)

### createAutonomousPR()

```typescript
async function createAutonomousPR(
  branch: string,
  title: string,
  body: string,
  repoPath: string = process.cwd()
): Promise<string>  // Retorna PR URL
```

**Flujo:**
1. Obtener owner/repo de `git config --get remote.origin.url`
   - Regex: `/github\.com[:/](.+?)\/(.+?)(\.git)?\s*$/`
2. Obtener token: `process.env.GH_TOKEN` 鈫? `process.env.GITHUB_TOKEN` 鈫? `gh auth token`
3. Obtener base branch: `git symbolic-ref refs/remotes/origin/HEAD` (default: 'main')
4. POST a `https://api.github.com/repos/{owner}/{repo}/pulls`
   - Headers: `Authorization: Bearer {token}`, `Accept: application/vnd.github.v3+json`, `User-Agent: SofLIA-Hub-AutoDev`
   - Body: `{ title, head: branch, base, body }`
5. Retorna `data.html_url`

### Tool Declaration para Gemini

```typescript
const github_create_pr_declaration: FunctionDeclaration = {
  name: 'github_create_pr',
  description: 'Crea un Pull Request en GitHub program谩ticamente usando la API REST.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      branch: { type: SchemaType.STRING },
      title: { type: SchemaType.STRING },
      body: { type: SchemaType.STRING },
      repo_path: { type: SchemaType.STRING }  // opcional
    },
    required: ['branch', 'title', 'body']
  }
};
```

### Sistema de Cola WhatsApp (Standalone Mode)

Para cuando AutoDev corre fuera de Electron (standalone CLI), no tiene acceso directo a WhatsApp. Usa un sistema de cola basado en archivos:

```typescript
function queueWhatsAppNotification(phone: string, message: string) {
  const qPath = path.join(getUserDataPath(), 'whatsapp-queue.json');
  let queue = [];
  if (fs.existsSync(qPath)) queue = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  queue.push({ phone, message });
  fs.writeFileSync(qPath, JSON.stringify(queue), 'utf8');
}
```

La instancia principal de Electron hace polling cada 5 segundos de este archivo y env铆a los mensajes pendientes.

---

## 12. Validaci贸n y Safety Guards

> **Archivo:** `electron/autodev-validation.ts` (233 l铆neas)

### parseBuildErrors()

Parsea output de TypeScript compiler, Vite/Rollup, y esbuild:

```typescript
function parseBuildErrors(buildOutput: string): ParsedBuildError[] {
  interface ParsedBuildError {
    file: string;
    line?: number;
    column?: number;
    code?: string;    // e.g., 'TS2307', 'VITE_ERR', 'BUILD_FAIL'
    message: string;
  }

  // Patterns para TypeScript:
  // file.ts(line,col): error TS1234: message
  // file.ts:line:col - error TS1234: message

  // Patterns para Vite/Rollup:
  // failed to resolve import "X" in "file"
  // Could not resolve "X" from "file"
  // [vite] error ...
  // 鉁? [ERROR] ...

  // Fallback: si no parsea ning煤n error pero hay "build failed" 鈫? error gen茅rico
}
```

### findPhantomImports()

```typescript
function findPhantomImports(code: string, filePath: string, _repoPath: string): string[] {
  // Busca: from './relative-path' o from '../relative-path'
  // Para cada import relativo, resuelve la ruta absoluta
  // Prueba extensiones: '', '.ts', '.tsx', '.js', '.jsx', '.json'
  // Prueba: /index.ts, /index.tsx, /index.js
  // Si ninguna existe 鈫? phantom import
}
```

### isCodeComplete()

```typescript
function isCodeComplete(code: string): boolean {
  // 1. Rechaza si termina en '// ...', '...', o '// TODO'
  // 2. Cuenta braces { } considerando:
  //    - Strings (", ', `)
  //    - Line comments (//)
  //    - Block comments (/* */)
  //    - Escaped characters (\)
  // 3. Si braceCount > 2 鈫? truncado
}
```

### Error Memory (aprendizaje de errores)

```typescript
interface ErrorMemoryEntry {
  pattern: string;      // Patr贸n del error
  file: string;         // Archivo afectado
  fix: string;          // C贸mo se corrigi贸
  occurrences: number;  // Cu谩ntas veces ha ocurrido
  lastSeen: string;     // 脷ltima ocurrencia
}

function loadErrorMemory(): ErrorMemoryEntry[]    // Lee de autodev-error-memory.json
function saveErrorMemory(entries): void           // Guarda top 200 por frecuencia
```

### RESEARCH_TOOLS (Function Declarations para Gemini)

```typescript
const RESEARCH_TOOLS: FunctionDeclaration[] = [
  {
    name: 'web_search',
    description: 'Search the web for information about packages, vulnerabilities, best practices.',
    parameters: { type: OBJECT, properties: { query: STRING }, required: ['query'] }
  },
  {
    name: 'read_webpage',
    description: 'Read and extract text content from a URL.',
    parameters: { type: OBJECT, properties: { url: STRING }, required: ['url'] }
  },
  {
    name: 'read_file',
    description: 'Read a file from the project for additional context.',
    parameters: { type: OBJECT, properties: { path: STRING }, required: ['path'] }
  },
];
```

### Resumen de Safety Guards

| Guard | Qu茅 Previene | D贸nde se Aplica |
|-------|-------------|-----------------|
| **Package.json protection** | Modificaci贸n directa de package.json, package-lock.json, tsconfig.json, vite.config.ts | `implementStep()` |
| **Major version blocker** | Any major version bump en dependencias | Phase 2 SafetyFilter + `implementStep()` |
| **Dependency domination filter** | Planes con >50% pasos de dependencias | Phase 2 QualityGate |
| **Feature ratio gate** | Planes con <70% pasos de features | Phase 2 PlanGate |
| **Integration gate** | Planes que crean archivos nuevos sin integrarlos | `generatePlan()` |
| **Phantom import detector** | Imports de m贸dulos que no existen en el proyecto | `implementStep()` |
| **Truncation detector** | C贸digo con braces desbalanceados o trailing `...` | `implementStep()` |
| **Destructive rewrite blocker** | Archivos que se reducen >60% en tama帽o | `implementStep()` |
| **Blocked packages** | `npm install` de: electron, react, react-dom, vite, typescript, sharp | `implementStep()` |
| **NPM package verification** | Instalaci贸n de paquetes inexistentes (hallucination) | `verifyNpmPackage()` |
| **Protected branches** | Commits/push a main/master | `AutoDevGit` (todas las operaciones de escritura) |
| **Merge conflict cleaner** | Marcadores `<<<<<<<` despu茅s de operaciones de branch | Phase 4 |
| **Orphan file detector** | Archivos nuevos no importados en ning煤n lado | Phase 4 `verifyIntegration()` |
| **Dynamic tool validator** | `tools/dynamic/` debe exportar ToolSchema v谩lido | Phase 4 `verifyIntegration()` |
| **Git safety (execFile)** | Shell injection via argumentos git | `AutoDevGit` usa execFile, no exec |

---

## 13. Web Research y NPM Audit

> **Archivo:** `electron/autodev-web.ts` (197 l铆neas)

### webSearch()

```typescript
async function webSearch(query: string): Promise<{
  success: boolean;
  results?: string;   // HTML stripped, max 6000 chars
  error?: string;
}>
```
- Primary: DuckDuckGo HTML search (`https://html.duckduckgo.com/html/?q=...`)
- Fallback: Google search si DuckDuckGo falla
- User-Agent: Chrome/Windows spoofing
- Timeout: 15 segundos

### readWebpage()

```typescript
async function readWebpage(url: string): Promise<{
  success: boolean;
  content?: string;   // HTML stripped, max 8000 chars
  error?: string;
}>
```
- Timeout: 20 segundos
- Accept-Language: es-MX

### npmAudit()

```typescript
async function npmAudit(repoPath: string): Promise<{
  success: boolean;
  vulnerabilities: NpmAuditVulnerability[];
  error?: string;
}>
```
- Ejecuta: `npm audit --json`
- Timeout: 60 segundos, maxBuffer: 10MB
- Maneja exit code non-zero (npm audit retorna 1 si hay vulnerabilidades)
- Sort: critical > high > moderate > low > info

### npmOutdated()

```typescript
async function npmOutdated(repoPath: string): Promise<{
  success: boolean;
  packages: NpmOutdatedPackage[];
  error?: string;
}>
```
- Ejecuta: `npm outdated --json`
- Mismos timeouts/buffers que npmAudit

### fetchNpmPackageInfo()

```typescript
async function fetchNpmPackageInfo(packageName: string): Promise<{
  success: boolean;
  version?: string;
  description?: string;
  homepage?: string;
  error?: string;
}>
```
- Fetch: `https://registry.npmjs.org/{package}/latest`
- Timeout: 10 segundos

### stripHtml()

Remueve: `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>`, `<iframe>`, `<svg>`, todas las tags HTML, entidades HTML, normaliza whitespace.

---

## 14. Sandbox de Ejecuci贸n

> **Archivo:** `electron/autodev-sandbox.ts` (331 l铆neas)

### Zod Validation Schemas

```typescript
const ToolSchemas = {
  command: z.object({ command: z.string(), args: z.array(z.string()).optional() }),
  npmInstall: z.object({ packageName: z.string(), devDependency: z.boolean().optional() }),
  fileOperation: z.object({ path: z.string(), content: z.string().optional() }),
  open_file_on_computer: z.object({ path: z.string() }),
  open_application: z.object({ path: z.string() }),
  analyze_suspicious_link: z.object({ url: z.string().url("Debe ser una URL v谩lida") }),
};
```

### validateToolInput()

```typescript
function validateToolInput<T>(input: any, schema: any): T {
  // 1. Zod schema.safeParse() (no exceptions)
  // 2. Si falla: formatea error con field paths ('field.subfield': message)
  // 3. Sanitizador recursivo: Elimina &, |, ;, $, ` (command injection chars)
  // 4. Retorna valor sanitizado y tipado
}
```

### verifyNpmPackage()

```typescript
async function verifyNpmPackage(pkgName: string): Promise<boolean> {
  // 1. Separa nombre y version spec (@babel/core@^7.20.0 鈫? @babel/core, ^7.20.0)
  // 2. Fetch: https://registry.npmjs.org/{package}
  // 3. 404 鈫? throw "El paquete no existe en NPM (404). Posible alucinaci贸n."
  // 4. Si hay version spec:
  //    - Verifica exact version match en versions[]
  //    - Verifica dist-tags (latest, next, etc.)
  //    - Si no existe: throw con sugerencia de latest version
  // 5. Retorna true si v谩lido
}
```

### ToolSandbox.execute()

```typescript
class ToolSandbox {
  static async execute<T>(toolName: string, toolsMap: Record<string, ToolFunction>, input: unknown, customSchema?: any): Promise<T | ToolErrorResponse>;
  static async execute<T>(tool: ToolFunction, ...args: any[]): Promise<T | ToolErrorResponse>;

  // Flujo:
  // 1. Extrae tool del toolsMap o builtinTools (open_file_on_computer, open_application, analyze_suspicious_link)
  // 2. Si no encontrada 鈫? throw "Herramienta desconocida"
  // 3. Valida input con schema si existe
  // 4. Ejecuta tool con validated input
  // 5. Catch 鈫? ToolErrorResponse con fixSuggestion (LLM-friendly)
}
```

### ToolErrorResponse

```typescript
interface ToolErrorResponse {
  error: boolean | string;
  message?: string;
  fixSuggestion: string;  // Hint LLM-friendly para auto-correcci贸n
}
```

---

## 15. IPC Handlers

> **Archivo:** `electron/autodev-handlers.ts` (61 l铆neas)

### Canales Registrados (9 total)

| Canal IPC | Handler | Descripci贸n |
|-----------|---------|-------------|
| `autodev:log-feedback` | `selfLearnService.analyzeUserMessage(message, 'chat')` | Log feedback del usuario desde UI |
| `autodev:get-config` | `autoDevService.getConfig()` | Obtener configuraci贸n actual |
| `autodev:update-config` | `autoDevService.updateConfig(updates)` | Actualizar config, reinicia cron si es necesario |
| `autodev:run-now` | `autoDevService.runNow()` (async, no await) | Iniciar full run inmediatamente |
| `autodev:abort` | `autoDevService.abort()` | Abortar run actual via AbortController |
| `autodev:get-status` | `autoDevService.getStatus()` | Estado: running, currentRun, config, todayRunCount, cronActive, microFix |
| `autodev:get-history` | `autoDevService.getHistory()` | Historial de runs pasados |
| `autodev:micro-fix-status` | `autoDevService.getMicroFixStatus()` | Estado del micro-fix: queueLength, running, todayCount, maxDaily |
| `autodev:trigger-micro-fix` | `autoDevService.queueMicroFix(trigger)` | Encolar micro-fix manualmente |

### Event Forwarding al Renderer

```typescript
autoDevService.on('run-started', (run) => {
  getMainWindow()?.webContents.send('autodev:run-started', run);
});

autoDevService.on('run-completed', (run) => {
  getMainWindow()?.webContents.send('autodev:run-completed', run);
});

autoDevService.on('status-changed', (data) => {
  getMainWindow()?.webContents.send('autodev:status-changed', data);
});
```

### Shape de Respuesta (todos los handlers)

```typescript
{ success: boolean, error?: string, ...data }
```

---

## 16. Componente UI (React)

> **Archivos:** `src/components/AutoDevPanel.tsx` + `src/hooks/useAutoDevPanel.ts`

### Window API Esperada

```typescript
interface Window {
  autodev?: {
    getConfig: () => Promise<any>;
    updateConfig: (updates: any) => Promise<any>;
    runNow: () => Promise<any>;
    abort: () => Promise<any>;
    getStatus: () => Promise<any>;
    getHistory: () => Promise<any>;
    onRunStarted: (cb: (run: any) => void) => void;
    onRunCompleted: (cb: (run: any) => void) => void;
    onStatusChanged: (cb: (data: any) => void) => void;
    removeListeners: () => void;
  };
}
```

### AutoDevPanel Props

```typescript
interface AutoDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}
```

### Tabs del Panel

1. **Estado** 鈥? Status actual del run, bot贸n ejecutar/abortar, progreso
2. **Configuraci贸n** 鈥? Enable/disable, schedule (hora/d铆as), categor铆as, l铆mites
3. **Historial** 鈥? Lista de runs pasados con detalles expandibles
4. **Micro-Fix** 鈥? Estado del queue, trigger manual

### Constantes del UI

```typescript
const CATEGORY_INFO = {
  features: { label: 'Features', icon: '鉁?, color: 'blue' },
  security: { label: 'Seguridad', icon: '馃敀', color: 'red' },
  quality: { label: 'Calidad', icon: '鉁?, color: 'green' },
  performance: { label: 'Performance', icon: '鉀?, color: 'yellow' },
  dependencies: { label: 'Dependencias', icon: '馃摝', color: 'purple' },
  tests: { label: 'Tests', icon: '馃, color: 'cyan' },
};

const STATUS_LABELS = {
  researching: 'Investigando...',
  analyzing: 'Analizando c贸digo...',
  planning: 'Planificando mejoras...',
  coding: 'Implementando cambios...',
  verifying: 'Verificando build...',
  pushing: 'Publicando cambios...',
  completed: 'Completado',
  failed: 'Fallido',
  aborted: 'Abortado',
};
```

---

## 17. CLI Standalone

> **Archivo:** `scripts/autodev.ts` (50 l铆neas)

```typescript
import 'dotenv/config';
import { AutoDevService } from '../electron/autodev-service';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runStandalone() {
  console.log('馃 Starting AutoDev Standalone (Terminal Mode)');

  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('鉂? Error: VITE_GEMINI_API_KEY no detectada en .env');
    process.exit(1);
  }

  const repoPath = join(__dirname, '..');
  const autoDev = new AutoDevService(repoPath);
  autoDev.setApiKey(apiKey);

  autoDev.on('status-changed', (d) => console.log(`[AutoDev Status] ${d.status}`));
  autoDev.on('agent-completed', (d) => console.log(`[AutoDev Agent] ${d.agent} (${d.role}) -> ${d.status}`));

  try {
    const run = await autoDev.runNow();
    if (run.status === 'completed') {
      console.log('鉁? AutoDev Ejecuci贸n Exitosa');
      console.log(`PR creado: ${run.prUrl}`);
      console.log(run.summary);
    } else {
      console.log(`鉂? AutoDev finaliz贸 con fallas (${run.status}).`);
      console.log(`Error: ${run.error}`);
    }
  } catch (err: any) {
    console.error('鉂? No se pudo completar el run:', err.message);
  }

  console.log('[!] Presiona ENTER para salir...');
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
}

runStandalone();
```

### Ejecuci贸n

```bash
npm run autodev
# Internamente: npx tsx scripts/autodev.ts
```

### Diferencias con Modo Electron

- No tiene acceso directo a WhatsApp 鈫? usa queue de archivos JSON
- Todos los imports de `electron` usan try/catch + `require()` din谩mico
- Misma clase AutoDevService (zero code duplication)
- Las rutas de userData se resuelven diferente:
  - Windows: `%APPDATA%/soflia-hub-desktop/.autodev-data/`
  - macOS: `~/Library/Application Support/soflia-hub-desktop/.autodev-data/`
  - Linux: `~/.config/soflia-hub-desktop/.autodev-data/`

---

## 18. Integraci贸n en main.ts

### Imports (din谩micos)

```typescript
// electron/main.ts l铆neas 45-47
const { AutoDevService } = await import('./autodev-service')
const { registerAutoDevHandlers } = await import('./autodev-handlers')
const { SelfLearnService } = await import('./autodev-selflearn')
```

### Instanciaci贸n (l铆neas 88-89)

```typescript
const autoDevService = new AutoDevService(process.env.APP_ROOT)
const selfLearnService = new SelfLearnService(process.env.APP_ROOT)
```

### Wiring SelfLearn 鈫? AutoDev (l铆nea 106)

```typescript
selfLearnService.on('micro-fix-candidate', (trigger: any) =>
  autoDevService.queueMicroFix(trigger)
)
```

### Conexi贸n con WhatsApp Agent (l铆neas 492-505)

```typescript
// El agente de WhatsApp recibe el selfLearnService para rastrear mensajes
waAgent.setSelfLearnService(selfLearnService)

// Cada mensaje entrante de WhatsApp se analiza
selfLearnService.analyzeUserMessage(text, 'whatsapp', { jid, senderNumber })

// Mensajes reenviados tambi茅n
selfLearnService.analyzeUserMessage(text, 'whatsapp', { jid, senderNumber })
```

### Conexi贸n con AutoDevService (l铆nea 510)

```typescript
waAgent.setAutoDevService(autoDevService)
```

### API Key y Startup (l铆neas 530-566)

```typescript
// Cuando se obtiene la API key (durante initWhatsAppAgent):
autoDevService.setApiKey(apiKey)

// Notificaciones WhatsApp
autoDevService.on('notify-whatsapp', ({ phone, message }: any) => {
  if (waAgent) {
    waService.sendText(`${phone}@s.whatsapp.net`, message).catch(() => {})
  }
})

// Iniciar cron si est谩 configurado
if (!autoDevService.isRunning()) {
  autoDevService.start()
}
```

### Polling de Queue Offline (l铆neas 568-582)

```typescript
// Cada 5 segundos, revisa si el CLI standalone dej贸 mensajes pendientes
setInterval(() => {
  try {
    const qtPath = require('path').join(
      require('electron').app.getPath('userData'), '.autodev-data'
    );
    const qPath = require('path').join(qtPath, 'whatsapp-queue.json');
    const fs = require('fs');
    if (fs.existsSync(qPath) && waService.getStatus().connected) {
      const msgs = JSON.parse(fs.readFileSync(qPath, 'utf8'));
      fs.unlinkSync(qPath);  // Eliminar despu茅s de leer
      for (const msg of msgs) {
        waService.sendText(`${msg.phone}@s.whatsapp.net`, msg.message).catch(() => {});
      }
    }
  } catch {}
}, 5000);
```

### Registro de IPC Handlers (l铆nea 644)

```typescript
registerAutoDevHandlers(autoDevService, selfLearnService, () => win)
```

### Graceful Shutdown

```typescript
autoDevService.stop()  // Detiene cron job al cerrar la app
```

---

## 19. Eventos del Sistema

### AutoDevService (EventEmitter)

| Evento | Payload | Cu谩ndo |
|--------|---------|--------|
| `run-started` | `AutoDevRun` | Cuando inicia un full o micro run |
| `run-completed` | `AutoDevRun` | Cuando termina un run (茅xito o fallo) |
| `status-changed` | `{ runId, status, agents }` | Cuando cambia el status del run |
| `agent-completed` | `{ runId, agent, role, status }` | Cuando un agente termina |
| `config-updated` | `AutoDevConfig` | Cuando se actualiza configuraci贸n |
| `notify-whatsapp` | `{ phone, message }` | Cuando hay mensaje para WhatsApp |

### SelfLearnService (EventEmitter)

| Evento | Payload | Cu谩ndo |
|--------|---------|--------|
| `micro-fix-candidate` | `MicroFixTrigger` | Cuando detecta issue micro-fixable |

---

## 20. Persistencia de Datos

### Archivos JSON (userData/.autodev-data/)

| Archivo | Contenido | Escritor |
|---------|-----------|----------|
| `autodev-config.json` | Configuraci贸n actual | AutoDevService.saveConfig() |
| `autodev-history.json` | Historial de runs (max 50) | AutoDevService.saveHistory() |
| `autodev-error-memory.json` | Patrones de errores aprendidos (max 200) | saveErrorMemory() |
| `whatsapp-queue.json` | Cola de mensajes WhatsApp (standalone) | queueWhatsAppNotification() |

### Archivos JSON (userData/)

| Archivo | Contenido | Escritor |
|---------|-----------|----------|
| `autodev-strategic-memory.json` | Memoria estrat茅gica completa | StrategicMemoryService.save() |

### Archivos Markdown (ra铆z del repo)

| Archivo | Contenido | Escritor |
|---------|-----------|----------|
| `AUTODEV_ISSUES.md` | Issues auto-detectados (max 200 entries) | SelfLearnService.logEntry() |
| `AUTODEV_FEEDBACK.md` | Sugerencias de usuarios (max 200 entries) | SelfLearnService.logFeedback() |

---

## 21. Dependencias Externas

### Paquetes NPM Requeridos

```json
{
  "@google/generative-ai": "0.24.1",   // Gemini AI SDK (function calling, multimodal)
  "zod": "3.24.2",                      // Validaci贸n de schemas
  "cron": "4.4.0",                      // Cron jobs (node-cron pattern)
  "dotenv": "^16.x"                     // Para CLI standalone (.env loading)
}
```

### APIs Externas

| API | Uso | Autenticaci贸n |
|-----|-----|---------------|
| Google Gemini | Todos los agentes AI | `VITE_GEMINI_API_KEY` |
| GitHub REST API | Creaci贸n de PRs | `GH_TOKEN` / `GITHUB_TOKEN` / `gh auth token` |
| NPM Registry | Verificaci贸n de paquetes | Sin auth (p煤blico) |
| DuckDuckGo HTML | B煤squeda web | Sin auth |
| Google Search | Fallback de b煤squeda | Sin auth |

### CLIs Requeridos

| CLI | Uso |
|-----|-----|
| `git` | Todas las operaciones Git |
| `gh` | GitHub CLI para crear PRs y verificar auth |
| `npm` | audit, outdated, install |
| `npx` | `npx tsc --noEmit` para build verification |

---

## Ap茅ndice: Compatibilidad Standalone

Todos los imports de `electron` deben usar try/catch + require() din谩mico:

```typescript
// CORRECTO 鈥? funciona en Electron y standalone
let app: { getPath: (name: string) => string } | undefined;
try {
  const electron = require('electron');
  app = electron.app;
} catch {
  // Running outside Electron (standalone CLI mode)
}

// INCORRECTO 鈥? crashea en standalone
import { app } from 'electron';
```

Este patr贸n se usa en:
- `autodev-strategic-memory.ts` (l铆neas 16-22)
- `autodev-validation.ts` (l铆neas 145-159)
- `autodev-github.ts` (l铆neas 110-128)
