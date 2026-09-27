# AGENTS.md — Ask Mode

Context for answering questions about VECTRA.

## Key Context

- VECTRA is not a generic AI chatbot or code scanner. It is a structured, evidence-based developer workflow platform with 8 defined sequential stages.
- The full architecture, sub-tasks, and design rationale are in `vectra-plan.md`. Sub-Tasks 1–7 are complete; Sub-Task 8 (Issue Detail + Impact Map pages) is in progress.
- IBM Bob is invoked via `IBM Bob Shell CLI (`bob run`)` (`Agent.prompt` / `Agent.create`) — NOT via CLI spawn. `BOB_API_KEY` must be set as an env var.
- All measurements shown in the UI come from real tool output. Nothing is hardcoded or fabricated.
- The sample app in `sample-app/` is deliberately imperfect — its bugs are intentional and serve as the demo target.

## Non-Obvious Organization

- `backend/src/analysis/` — deterministic tools only (ESLint v10 programmatic, ts-morph AST, Jest spawn, impact tracer). Zero AI tokens.
- `backend/src/bob/` — sole entry point for `IBM Bob Shell CLI (`bob run`)`. No other file imports the SDK.
- `backend/src/scripts/` — smoke test scripts (`smoke-test.ts`, `smoke-test-impact.ts`, `smoke-test-report.ts`) that verify the backend against real sample-app output. Run with `npx ts-node --transpile-only src/scripts/smoke-test.ts`.
- `data/` — flat JSON cache files keyed by `md5(projectPath)`. Separate `data/reports/` subdir for `ProjectReport` JSONs. Not a database; no migrations.
- Shared TypeScript types in `backend/src/types/` are **manually mirrored** in `frontend/src/types/index.ts` — there is no code generation step.
- Frontend linting uses **oxlint** (`npm run lint` in `frontend/`), not ESLint. ESLint is backend-only (analysis engine).
- Tailwind v4 is active: `@import "tailwindcss"` in `frontend/src/index.css`, `@tailwindcss/vite` plugin. No `tailwind.config.js` exists — all customisation is via CSS custom properties in `index.css`.
