# AutoDev — Guía de Migración a Nuevo Repositorio

## Qué es este paquete

Este paquete contiene **todo el código fuente** del sistema AutoDev de SofLIA Hub — un sistema de auto-programación autónoma multi-agente que usa Google Gemini AI para analizar, mejorar y corregir código automáticamente.

---

## Estructura de archivos

```
autodev-package/
├── MIGRATION-README.md          ← Este archivo
├── AUTODEV-DOCUMENTATION.md     ← Documentación exhaustiva (21 secciones)
├── electron/
│   ├── autodev-service.ts       ← Orquestador principal (~2400 líneas) — Pipeline completo de 7 fases + micro-fix de 4 fases
│   ├── autodev-types.ts         ← Todos los tipos TypeScript: Config, Run, Improvement, MicroFix, etc.
│   ├── autodev-prompts.ts       ← 10 prompts de Gemini (analysis, plan, code, review, summary, micro-fix)
│   ├── autodev-strategic-memory.ts ← Memoria estratégica persistente (roadmap, capacidades, retrospectivas)
│   ├── autodev-selflearn.ts     ← Detección de fallos/sugerencias de usuario, clasificación micro-fix
│   ├── autodev-git.ts           ← Operaciones Git (branch, commit, push, cleanup)
│   ├── autodev-github.ts        ← GitHub REST API para crear PRs + cola WhatsApp standalone
│   ├── autodev-web.ts           ← Web search (DuckDuckGo/Google), readWebpage, npmAudit, npmOutdated
│   ├── autodev-sandbox.ts       ← Sandbox de ejecución con validación Zod, verificación npm
│   ├── autodev-validation.ts    ← Parsing de errores de build, phantom imports, isCodeComplete, constantes
│   ├── autodev-helpers.ts       ← Utilidades puras: readProjectFiles, generateCommitMessage, parseJSON, etc.
│   ├── autodev-handlers.ts      ← IPC handlers (9 canales autodev:*)
│   └── utils/
│       └── concurrency.ts       ← runParallel() — ejecución paralela con límite de concurrencia
├── scripts/
│   └── autodev.ts               ← CLI standalone (npx tsx scripts/autodev.ts)
└── src/
    ├── components/
    │   └── AutoDevPanel.tsx      ← Panel UI React (control, config, historial, estado)
    └── hooks/
        └── useAutoDevPanel.ts    ← Hook del panel (parseCron, buildCron, formatDuration, etc.)
```

---

## Dependencias necesarias

### NPM packages requeridos

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "zod": "^3.24.2",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^20.0.0"
  }
}
```

### Dependencias opcionales (según contexto)

| Paquete | Cuándo es necesario |
|---------|-------------------|
| `electron` | Solo si se integra en app Electron (IPC, powerMonitor, tray) |
| `framer-motion` | Solo para el componente AutoDevPanel.tsx (UI) |
| `react` + `react-dom` | Solo para la UI |
| `tailwindcss` | Solo para estilos del panel UI |

---

## Cómo integrar en el nuevo repositorio

### Paso 1: Copiar archivos

```bash
# Copiar toda la carpeta electron/ del paquete al nuevo repo
cp -r autodev-package/electron/ nuevo-repo/electron/

# Copiar utilidades
cp -r autodev-package/electron/utils/ nuevo-repo/electron/utils/

# Copiar script CLI
cp -r autodev-package/scripts/ nuevo-repo/scripts/

# (Opcional) Copiar UI React
cp -r autodev-package/src/ nuevo-repo/src/
```

### Paso 2: Instalar dependencias

```bash
npm install @google/generative-ai zod node-cron dotenv
```

### Paso 3: Configurar variables de entorno

En `.env`:
```
VITE_GEMINI_API_KEY=tu-api-key-de-google-gemini
```

### Paso 4: Agregar script en package.json

```json
{
  "scripts": {
    "autodev": "npx tsx scripts/autodev.ts"
  }
}
```

### Paso 5: Adaptar imports según el nuevo repo

Los archivos usan imports relativos entre sí. Si cambias la estructura de carpetas, actualiza los imports.

**Imports internos del sistema AutoDev (no tocar si mantienes la estructura):**
```
autodev-service.ts → importa de: autodev-types, autodev-prompts, autodev-strategic-memory, autodev-git, autodev-github, autodev-web, autodev-validation, autodev-helpers, utils/concurrency
autodev-helpers.ts → importa de: autodev-types, autodev-validation
autodev-handlers.ts → importa de: autodev-service (singleton)
scripts/autodev.ts → importa de: ../electron/autodev-service
```

### Paso 6: Adaptar para entorno NO-Electron

AutoDev ya soporta ejecución standalone. Los archivos usan `try/catch` dinámico para imports de Electron:

```typescript
// Este patrón ya existe en el código — NO necesita cambios
let powerMonitor: any;
try {
  const electron = require('electron');
  powerMonitor = electron.powerMonitor;
} catch {
  // Running outside Electron
}
```

**Si el nuevo repo NO usa Electron en absoluto:**
1. Eliminar `autodev-handlers.ts` (IPC handlers)
2. Eliminar `AutoDevPanel.tsx` y `useAutoDevPanel.ts` (UI Electron)
3. Eliminar las referencias a `powerMonitor` en `autodev-service.ts`
4. El sistema funciona perfectamente desde `scripts/autodev.ts`

### Paso 7: Configurar Git y GitHub

AutoDev necesita:
- Un repositorio Git inicializado con remote configurado
- GitHub CLI (`gh`) autenticado para crear PRs
- O alternativamente: token de GitHub como variable de entorno `GITHUB_TOKEN`

```bash
# Verificar que gh está autenticado
gh auth status

# O configurar token
export GITHUB_TOKEN=ghp_tu-token-aqui
```

---

## Configuración por defecto

AutoDev arranca con esta configuración (modificable via `autodev-config.json` en userData):

```typescript
{
  enabled: false,                    // Activar manualmente
  cronSchedule: '0 3 * * *',        // Ejecutar a las 3 AM
  targetBranch: 'main',             // Branch base
  workBranchPrefix: 'autodev/',     // Prefijo de branches de trabajo
  maxFilesPerRun: 30,               // Máximo archivos por ejecución
  maxDailyRuns: 3,                  // Máximo runs diarios
  maxLinesChanged: 2000,            // Máximo líneas cambiadas
  maxResearchQueries: 30,           // Máximo búsquedas web
  requireBuildPass: true,           // Requiere npx tsc --noEmit OK
  autoMerge: false,                 // NO auto-merge (siempre PR)
  agents: {
    researcher:   { model: 'gemini-3-flash-preview' },
    coder:        { model: 'gemini-3.1-pro-preview-customtools' },
    reviewer:     { model: 'gemini-3-flash-preview' },
    security:     { model: 'gemini-3-flash-preview' },
    dependencies: { model: 'gemini-3-flash-preview' },
    tester:       { model: 'gemini-3-flash-preview' },
  },
  microFix: {
    enabled: true,
    maxDailyMicroRuns: 5,
    debounceMinutes: 3,
    maxFiles: 5,
    maxLines: 200,
  },
}
```

---

## Pipelines

### Full Run (7 fases)
```
Phase 0: Strategic Awareness → Selecciona estrategia (innovation/deep-improvement/user-driven/gap-filling/integration/resilience)
Phase 1: Parallel Research → 5 agentes + npm audit/outdated con Google Search grounding
Phase 1.5: Deep Agentic Research → Gemini con function calling (web_search, read_webpage, read_file)
Phase 2: Analysis + Planning → SafetyFilter + QualityGate + PlanGate + IntegrationGate
Phase 3: Parallel Coding → 2 coders con safety guards (phantom imports, truncation, destructive rewrite)
Phase 4: Review + Build → npx tsc --noEmit, integration check, hasta 4 retries con auto-fix
Phase 5: Commit + Push + PR → Git branch, GitHub PR, WhatsApp notification
Phase 6: Retrospective → Auto-evaluación, lecciones, actualización de roadmap
```

### Micro-Fix (4 fases)
```
Phase 1: Analyze → Lee archivos relevantes, analiza trigger
Phase 2: Code Fix → Implementa corrección (mismos safety guards)
Phase 3: Build Verify → npx tsc --noEmit, 1 retry con auto-fix
Phase 4: Commit + Push + PR → Branch, PR, notificación
```

---

## Safety Guards implementados

| Guard | Qué previene |
|-------|-------------|
| Package.json protection | Modificación directa de package.json, tsconfig.json, vite.config.ts |
| Major version blocker | Bumps de versión mayor en dependencias |
| Dependency domination filter | Planes con >50% pasos de dependencias |
| Feature ratio gate | Planes deben tener >70% pasos de features/quality |
| Integration gate | Archivos nuevos deben tener paso de integración en main.ts |
| Phantom import detector | Imports de módulos que no existen en el proyecto |
| Truncation detector | Código con llaves desbalanceadas o trailing `...` |
| Destructive rewrite blocker | Archivos que se reducen >60% en tamaño |
| Orphan file detector | Archivos nuevos no importados en ningún lado |
| Dynamic tool validator | Archivos en tools/dynamic/ deben exportar ToolSchema válido |
| Git safety | Nunca hace commit directo a main/master |
| NPM package verifier | Verifica que paquetes existen en registry antes de instalar |
| Blocked packages | electron, react, react-dom, vite, typescript, sharp no se actualizan |

---

## Cómo ejecutar

### Modo CLI (standalone, sin Electron)
```bash
npm run autodev
# o directamente:
npx tsx scripts/autodev.ts
```

### Modo Electron (integrado en app)
```typescript
import { AutoDevService } from './electron/autodev-service';

const autodev = new AutoDevService(repoPath);
autodev.setApiKey(process.env.VITE_GEMINI_API_KEY);

// Escuchar eventos
autodev.on('status-changed', (data) => console.log(data.status));
autodev.on('run-completed', (run) => console.log(run.summary));

// Ejecutar
const run = await autodev.runNow();
```

---

## Archivos que NO están en este paquete (dependencias externas del Hub)

Estos archivos son usados por AutoDev pero pertenecen a otros sistemas del Hub. Si los necesitas, deberás crearlos o adaptarlos:

| Archivo | Qué hace | Necesario? |
|---------|----------|-----------|
| `electron/safe-browser-tool.ts` | Análisis de URLs sospechosas | Solo si usas `analyze_suspicious_link` |
| `electron/main.ts` | Entry point de Electron | Solo si integras en Electron |
| `electron/preload.ts` | IPC bridge | Solo si integras en Electron |
| `src/config.ts` | Configuración de modelos AI | Referencia para model IDs |

---

## Notas importantes para Claude en el nuevo repo

1. **Lee AUTODEV-DOCUMENTATION.md primero** — tiene los 10 prompts completos, todos los tipos, todos los regex del SelfLearn, y la arquitectura detallada.

2. **El código fuente es la verdad** — si hay discrepancia entre la documentación y el código, el código manda.

3. **Mantén los safety guards** — son el resultado de meses de iteración. Cada guard existe porque hubo un incidente real.

4. **El patrón de fallback es crítico** — cuando Gemini devuelve 429 (rate limit), el sistema espera 45s y cambia a `gemini-3-flash-preview`. No elimines esta lógica.

5. **La memoria estratégica es lo que hace a AutoDev "inteligente"** — sin ella, cada run es independiente y no aprende. Asegúrate de que `autodev-strategic-memory.json` persista entre ejecuciones.

6. **Los prompts están en español** — todo el sistema está diseñado para operar en español. Si necesitas inglés, traduce los prompts en `autodev-prompts.ts`.

7. **readProjectFiles() tiene presupuesto** — máximo 300K chars totales, 25K por archivo, prioriza `electron/` > `src/` > resto. Ajusta si el nuevo repo tiene estructura diferente.
