# Contexto del Stack — AQELOR

> Este archivo contiene datos factuales del proyecto. No contiene instrucciones.
> Se carga siempre junto con `_maestro-universal.md` para dar contexto a cualquier prompt especializado.

## Producto

- **Nombre comercial:** AQELOR (Autonomous Quality, Upgrade, Engineering, Learning, Orchestration & Repositories)
- **Scope npm:** `@auria/*` (nombre técnico del workspace, no confundir con el brand)
- **Tipo:** Sistema autónomo de mejora continua de repositorios con agente multi-modelo

## Monorepo (npm workspaces)

```
apps/desktop           → Electron 41 + React 19 + Vite 7 (cliente escritorio)
apps/local-worker      → Node.js worker autónomo (pipeline de misiones)
packages/contracts     → Zod schemas y tipos compartidos (@auria/contracts)
packages/domain        → Lógica de negocio, servicios, ports, prompts (@auria/domain)
packages/ui            → Componentes React compartidos (@auria/ui)
packages/config        → Presets TypeScript compartidos (@auria/config)
supabase/              → Migraciones SQL, Edge Functions (Deno), Auth config
```

## Stack técnico

- **Lenguaje:** TypeScript 5.9 (strict mode obligatorio)
- **Desktop:** Electron 41 (main / preload / renderer)
- **UI:** React 19, Tailwind CSS 4, Radix UI, shadcn, Framer Motion
- **Estado:** Zustand 5 (local), TanStack React Query 5 (server state)
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Realtime)
- **AI:** Multi-provider via Vertex AI (Claude, Gemini, Mistral, GPT)
- **Testing:** Vitest 4
- **Build:** electron-vite, Vite 7

## Arquitectura

- **Renderer:** Organización por features (`src/renderer/features/{auth,dashboard,repository,settings}/`)
- **Shared:** Componentes y hooks reutilizables (`src/renderer/shared/`)
- **Domain:** Servicios puros, entidades, ports/adapters, prompts de IA (`packages/domain/src/`)
- **Contracts:** Validación Zod en fronteras entre runtimes (`packages/contracts/src/`)
- **IPC:** Contratos tipados main↔renderer vía preload bridge

## Reglas de diseño (de `docs/architecture.md`)

1. El estado del frontend nunca accede directamente a OS o repositorio
2. Integraciones desktop viven en `main` y `preload`, detrás de contratos IPC estrechos
3. Lógica del worker aislada de concerns de UI
4. Datos validados con Zod antes de cruzar fronteras de runtime
5. Lógica de negocio en `packages/domain` para servir desktop, worker y futuros servicios

## Vocabulario del dominio (de `@auria/contracts`)

- **Agent Roles:** planner, risk, research, review, test, debt, security, dependency, coverage, docs, performance, refactor, innovation, verification, memory
- **Tool Categories:** knowledge, documentation, research, quality, improvement, qa_correction, security, optimization, spaghetti_cleanup, implementation
- **Risk Levels:** low, moderate, high, critical
- **Mission Status:** discovered → analyzing → researching → executing → validating → review → completed
- **Workspace Modes:** cloud, local, hybrid
