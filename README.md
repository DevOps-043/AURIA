# AURIA

Autonomous Upgrade & Repository Intelligence Automation.

## What is in this repo

This repository turns the PRD into a production-ready monorepo foundation:

- `apps/desktop`: Electron + React desktop application.
- `apps/local-worker`: isolated local execution plane.
- `packages/contracts`: shared schemas and runtime-safe contracts.
- `packages/domain`: policy logic, worker planning and seed data.
- `packages/ui`: reusable UI primitives.
- `supabase`: initial database schema and edge function stub.

## Run the project

```bash
npm install
npm run dev
```

Worker demo:

```bash
npm run worker:demo
```

Typecheck and tests:

```bash
npm run typecheck
npm run test
```

Architecture notes live in `docs/architecture.md`.
