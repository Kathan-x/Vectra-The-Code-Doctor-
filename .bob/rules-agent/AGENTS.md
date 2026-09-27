# AGENTS.md — Agent (Coding) Mode

Rules for writing and modifying VECTRA application code.

## Before Writing Code

- Read `vectra-plan.md` to understand which sub-task you are in and what the expected outcomes are.
- Check `data/` for cached analysis output before triggering re-analysis.
- Check `backend/src/types/` for existing shared types before defining new ones.
- Verify Sub-Task 8 completion status before beginning Sub-Task 9 — they must be sequential.

## Non-Obvious Patterns

- **ESLint programmatic API** in `backend/src/analysis/eslint-runner.ts` — NEVER shell out to `eslint` CLI. Use `import { ESLint } from 'eslint'`, call in-process with `overrideConfigFile: true`.
- **ESLint v10 flat config plugin prefix:** plugins registered as `vectra: { rules: CUSTOM_RULES }` use rules as `'vectra/no-sql-concat'`, NOT `'plugin/vectra/no-sql-concat'`. `eslint-plugin-security` must be `require()`d (not `import`ed) to avoid ESM/CJS interop crash.
- **ts-morph scope:** call `project.addSourceFilesAtPaths()` with only the specific files in scope — never load the entire repo or it will be extremely slow.
- **Test runner spawn:** use `process.execPath` (node binary) + absolute path to `node_modules/.bin/jest` — not `jest.cmd`, not `npx jest`. This is mandatory on Windows where paths contain spaces. Parse via `--json` flag, captured from stdout.
- **Bob `@cursor/sdk` usage:** `Agent.prompt` for one-shot (no `onChunk`); `await using agent = await Agent.create(...)` + `agent.send(prompt)` + `run.stream()` for streaming. The `await using` syntax (explicit resource management) is intentional — do not refactor it away.
- **Bob `cwd`:** always the **target project path** (`sample-app/` absolute path), never the VECTRA backend dir.
- **Streaming SSE:** repair routes write `res.write('data: ...\n\n')` per chunk. Do NOT buffer the full Bob output; stream it live.
- **Analysis cache key:** `crypto.createHash('md5').update(path.resolve(projectPath)).digest('hex')` → `data/{hash}.json`. Cache is valid when no file's mtime exceeds `entry.mtime`. Use `readCache`/`writeCache` from `backend/src/analysis/cache.ts`.
- **`data/` dir:** created at runtime by `cache.ts` and `report-engine.ts`. Do NOT pre-create it or check-in contents.

## TypeScript Gotchas

- **Frontend:** `verbatimModuleSyntax: true` — all type-only imports MUST use `import type`. Missing `type` keyword is a compile error.
- **Frontend:** `erasableSyntaxOnly: true` (TS 6) — no `const enum`, no legacy decorators, no `namespace`. These are compile errors.
- **Backend:** CommonJS output (`"module": "commonjs"`) — do NOT use top-level `await` or `.mjs`-style dynamic imports.
- **Frontend tsconfig** uses `ignoreDeprecations: "6.0"` to suppress TS 6 deprecation warnings — this is intentional, do not remove it.

## Import Order (enforced by ESLint / oxlint)

Backend:
1. Node built-ins (`path`, `fs`, `child_process`, `crypto`)
2. Third-party packages
3. Internal types (`../types`)
4. Relative imports (`./module`)

Frontend (path alias `@/` = `src/`):
1. Third-party (`react`, `react-router-dom`, `lucide-react`)
2. Internal absolute (`@/types`, `@/lib/api`, `@/lib/tokens`)
3. Relative component imports

## Type Discipline

- Canonical domain types (import always from `backend/src/types/` or `@/types` in frontend):
  `Finding`, `PrioritizedIssue`, `ImpactMap`, `RepairPlan`, `ReviewResult`,
  `ProjectReport`, `AnalysisSnapshot`, `ReportStatus`, `BeforeAfterDelta`
- Frontend mirrors these in `frontend/src/types/index.ts` — keep in sync manually when backend types change.
- No `any` in route handlers. API responses are always fully typed.

## UI Components

- `frontend/src/components/ui/` contains hand-written shadcn/ui components (Tailwind v4 broke the CLI). Edit manually when needed — do NOT run `npx shadcn-ui add`.
- Custom components: `frontend/src/components/{layout,dashboard,issue,impact}/`
- Severity/category display: always use helpers from `frontend/src/lib/tokens.ts` (`severityColor`, `severityBg`, `severityDot`, `categoryLabel`) — never inline Tailwind colour classes for severity.
- `cn()` utility: import from `@/lib/tokens` (re-exported there) or `@/lib/utils`.
