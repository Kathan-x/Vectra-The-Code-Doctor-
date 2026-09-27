# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

VECTRA — IBM Bob 2.0 Hackathon. Web-based developer workflow platform:
**DISCOVER → DIAGNOSE → PRIORITIZE → TRACE IMPACT → REPAIR → REVIEW → VERIFY → PROVE**

See `vectra-plan.md` for the full architecture and sub-task breakdown (Sub-Tasks 1–7 complete; 8 in progress).

## Repository Layout

```
VECTRA/
├── frontend/        # React 19 + Vite 8 + TypeScript 6 + Tailwind v4
├── backend/         # Node.js + Express + TypeScript (CommonJS)
├── sample-app/      # Deliberately imperfect Node.js + Express demo target
├── data/            # Runtime JSON cache — gitignored, created at runtime
└── vectra-plan.md   # Full implementation plan
```

## Commands

```bash
# From repo root (concurrently)
npm run dev          # Starts backend (ts-node-dev :3001) + frontend (Vite :5173)
npm run build        # tsc (backend) then tsc -b && vite build (frontend)
npm run test         # vitest run in both workspaces

# Backend only (cd backend first)
npm run dev          # ts-node-dev --respawn --transpile-only src/index.ts
npm run build        # tsc  →  dist/
npx vitest run                              # all backend tests
npx vitest run src/path/to/file.test.ts     # single test file

# Frontend only (cd frontend first)
npm run dev          # Vite dev on :5173 with /api proxy to :3001
npm run build        # tsc -b && vite build
npm run lint         # oxlint (NOT eslint — frontend uses oxlint)
npx vitest run src/path/to/file.test.ts

# Typecheck without building
cd backend  && npx tsc --noEmit
cd frontend && npx tsc -b --noEmit

# Sample-app tests (Jest — the VECTRA analysis demo target)
cd sample-app && npm test
```

**NEVER run `ts-node-dev` or `npm run dev` as a foreground verification command** — they never exit. Always use `tsc --noEmit` or `npm run build` for verification.

## Stack (non-obvious versions)

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19, TypeScript **6**, Vite **8** | `verbatimModuleSyntax`, `erasableSyntaxOnly` enabled |
| Frontend CSS | Tailwind **v4** | `@import "tailwindcss"` in CSS — no `tailwind.config.js` |
| Frontend lint | **oxlint** | Not ESLint — `npm run lint` in frontend runs oxlint |
| Backend | CommonJS (`"module": "commonjs"`) | Frontend is ESM (`"type": "module"`) — they differ |
| Analysis | ESLint v10 flat config + ts-morph | Programmatic API only — never shell out to `eslint` CLI |
| Bob | `IBM Bob Shell CLI (`bob run`)` `Agent.prompt` / `Agent.create` | `BOB_API_KEY` env var required; missing → graceful degradation |
| Tests (VECTRA) | Vitest | Both workspaces |
| Tests (sample-app) | Jest | Child process spawn — `node <jestBin> --json` |

## Critical Constraints

- **Bob via `IBM Bob Shell CLI (`bob run`)` only.** Import only from `backend/src/bob/bob-client.ts`. No other file may import `IBM Bob Shell CLI (`bob run`)` directly. Pass `local: { cwd }` set to the **target project root** (not VECTRA root).
- **No invented metrics.** All counts (findings, test pass/fail) come from real tool output. Never hardcode numbers.
- **Cache invalidation** is mtime-based: `data/{md5(projectPath)}.json` is stale if any source file's mtime exceeds `entry.mtime`. Use `readCache`/`writeCache` from `backend/src/analysis/cache.ts`.
- **Windows paths everywhere.** Use `path.join()`. No hardcoded `/` separators.
- **ESLint v10 flat config plugin key:** Custom rules registered as `vectra: { rules: CUSTOM_RULES }` and referenced as `'vectra/no-sql-concat'` (NOT `'plugin/vectra/...'`). `eslint-plugin-security` loaded via `require()` to avoid ESM/CJS interop issues.
- **Test runner spawn:** Jest invoked as `node <jestBin> --json` (not `jest.cmd`, not `npx`) using `process.execPath` — mandatory on Windows for paths with spaces.

## Code Style

- TypeScript strict mode in both workspaces
- **Frontend:** `verbatimModuleSyntax` — use `import type` for all type-only imports
- **Backend:** CommonJS — use `import`/`export` syntax (ts-node transpiles), but do NOT use top-level `await`
- Canonical domain types: `Finding`, `PrioritizedIssue`, `ImpactMap`, `RepairPlan`, `ReviewResult`, `ProjectReport`. Always import from `backend/src/types/` — never re-declare equivalent shapes
- Frontend types mirror backend in `frontend/src/types/index.ts` — **keep manually in sync**
- All async: `async/await` only — no raw `.then()` chains
- Express error responses: `{ error: string, code?: string }` shape — nothing else
- All fetch calls go through `frontend/src/lib/api.ts` — never `fetch()` directly in components
- Severity/category display helpers live in `frontend/src/lib/tokens.ts` — always use them, never inline Tailwind severity colours
- `cn()` is re-exported from `frontend/src/lib/tokens.ts` (imported from `@/lib/utils`)
- **shadcn/ui components are hand-written** (Tailwind v4 broke the CLI) — do not run `npx shadcn-ui add`; edit `frontend/src/components/ui/` manually if needed

## IBM Bob Integration

- Entry point: `backend/src/bob/bob-client.ts` → `runBob(prompt, { cwd, maxTurns?, onChunk? })`
- One-shot (no streaming): uses `Agent.prompt` — simpler, auto-disposes
- Streaming: uses `await using agent = await Agent.create(...)` → `agent.send(prompt)` → `run.stream()` (async iterator, `event.type === 'assistant'`, `block.type === 'text'`)
- Repair routes stream via SSE (`res.write('data: ...\n\n')`) — never buffer full Bob output
- `isBobAvailable()` returns `{ available: false }` if `BOB_API_KEY` is unset — UI must degrade gracefully

## UI Rules

- Dark-only: design tokens defined as CSS custom properties in `frontend/src/index.css` (HSL values, no `dark:` variants needed)
- Monospace: use `font-mono` or `.mono` class for file paths, rule IDs, code snippets
- Every page/panel: loading state + empty state + error state — no placeholder data
- Severity colour mapping: always use `severityColor`, `severityBg`, `severityDot` from `frontend/src/lib/tokens.ts`
