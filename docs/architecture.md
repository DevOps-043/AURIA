# Auria architecture

This repository starts from the PRD and organizes the codebase as a small screaming monorepo: folders are named by product area and runtime responsibility instead of generic layer names.

## Workspace map

- `apps/desktop`
  Electron desktop client for Windows and Linux.
  - `src/main`: Electron main process and OS integrations.
  - `src/preload`: secure IPC bridge exposed to the renderer.
  - `src/renderer`: React application, feature routes and desktop UI state.
- `apps/local-worker`
  Local execution plane used to coordinate repo-safe work outside the renderer.
- `packages/contracts`
  Zod schemas and shared TypeScript contracts for every runtime.
- `packages/domain`
  Pure business logic, seed data, worker planning and policy gates.
- `packages/ui`
  Shared presentational building blocks for the renderer.
- `packages/config`
  Shared TypeScript presets.
- `supabase`
  Database migrations and edge function stubs for the control plane.

## Design rules

1. Frontend state stays in the renderer and never reaches directly into OS or repo concerns.
2. Desktop integrations stay in `main` and `preload`, behind narrow IPC contracts.
3. Worker logic is isolated from UI concerns so execution can evolve independently.
4. Shared contracts are validated with Zod before data crosses runtime boundaries.
5. Business logic lives in `packages/domain` so the same rules can serve desktop, worker and future services.

## MVP scope implemented here

- Electron + React + Vite desktop shell.
- Objective Builder, Policy Builder, Model Router, Mission Control, Review Center, Memory Console, Billing and Knowledge Intake screens.
- Local worker demo for mission coordination.
- Initial Supabase schema aligned to the PRD entity map.
- Contracts, policy gates and tests for domain logic.

## Next steps

1. Replace demo snapshot data with Supabase-backed queries and commands.
2. Add auth, subscription checkout and repository provider integration.
3. Connect the local worker to a real git sandbox and validation pipeline.
4. Add realtime mission events through Supabase Realtime.
5. Move review decisions and policy edits into persisted commands.
