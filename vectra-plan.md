# VECTRA — Implementation Plan

IBM Bob 2.0 Hackathon | Developer Workflow Platform

---

## Overview

VECTRA is a web-based developer workflow platform that transforms the fragmented debugging/repair cycle into one guided, evidence-based pipeline:

**DISCOVER → DIAGNOSE → PRIORITIZE → TRACE IMPACT → REPAIR → REVIEW → VERIFY → PROVE**

The developer loads an existing project. VECTRA analyzes it with deterministic local tooling, organizes findings, lets the developer open any issue and trace its impact, generates a repair plan, invokes IBM Bob to implement the repair, reviews and validates the changes, runs real tests, and produces a before/after engineering report.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| UI | shadcn/ui + Tailwind CSS (dark-first) |
| Backend | Node.js + Express + TypeScript |
| Code Analysis | ESLint programmatic API + ts-morph (AST) + custom static checks |
| Test Execution | child_process spawning target project's test runner |
| IBM Bob | Bob CLI invoked via child_process (Plan mode, Agent mode, subagents) |
| Persistence | JSON files on disk (analysis cache + reports in `/data/`) |
| Monorepo | `/frontend` + `/backend` + `/sample-app` |

---

## Repository Structure

```
VECTRA/
├── frontend/               # React + Vite + TypeScript UI
│   ├── src/
│   │   ├── components/     # shadcn/ui + custom components
│   │   ├── pages/          # Route-level pages (Dashboard, Issue, Repair, Report)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API client, utilities
│   │   └── types/          # Shared TypeScript types (mirrored from backend)
│   ├── index.html
│   └── vite.config.ts
│
├── backend/                # Express + TypeScript API server
│   ├── src/
│   │   ├── routes/         # Express route handlers
│   │   ├── analysis/       # Deterministic analysis engines
│   │   │   ├── discover.ts         # Project structure scan
│   │   │   ├── eslint-runner.ts    # ESLint programmatic API
│   │   │   ├── ast-analyzer.ts     # ts-morph AST traversal
│   │   │   ├── test-runner.ts      # Spawn + capture test output
│   │   │   └── impact-tracer.ts    # Dependency/call-graph tracing
│   │   ├── bob/            # IBM Bob integration layer
│   │   │   ├── bob-client.ts       # CLI invocation wrapper
│   │   │   ├── repair-workflow.ts  # Orchestrates Bob Plan+Agent cycle
│   │   │   └── review-workflow.ts  # Bob independent review pass
│   │   ├── reports/        # Report generation (before/after diff, summary)
│   │   └── types/          # Shared TypeScript types
│   └── tsconfig.json
│
├── sample-app/             # Deliberately imperfect Node.js + Express app
│   ├── src/                # Source with realistic bugs, security issue, code smells
│   ├── tests/              # Jest test suite (some failing, some passing)
│   └── package.json
│
├── data/                   # Runtime JSON cache (gitignored except .gitkeep)
│   └── .gitkeep
│
├── AGENTS.md               # Project context for AI assistants
├── vectra-plan.md          # This file
└── package.json            # Root scripts for dev/build
```

---

## Workflow Stages — Detail

### Stage 1: DISCOVER
- Backend scans the target project directory
- Produces: file tree, language detection, dependency graph, test file locations, framework detection
- Deterministic — zero AI tokens

### Stage 2: DIAGNOSE
- ESLint programmatic API runs on all JS/TS files
- ts-morph AST analysis: unused vars, dead code, missing error handling, type safety holes
- Custom checks: security patterns (hardcoded secrets, SQL injection patterns, missing input validation)
- Test runner executes the test suite and captures results (pass/fail/error per test)
- Produces: structured `FindingList` with severity, category, file, line, evidence

### Stage 3: PRIORITIZE
- Findings are scored by: severity × blast radius × test failure correlation
- Produces: ranked `PrioritizedIssueList` — developer sees what matters most first
- No AI required; scoring is deterministic formula

### Stage 4: TRACE IMPACT
- Developer opens a specific issue
- Backend uses ts-morph call graph to find all files/functions that reference the affected symbol
- Lists related tests that cover the affected code
- Shows dependency chain depth
- Produces: `ImpactMap` (affected files, callers, tests)

### Stage 5: REPAIR
- Backend generates a structured repair brief (issue + evidence + impact + context snippets)
- Invokes Bob in Plan mode via CLI: Bob produces a structured repair plan
- Developer reviews the plan in VECTRA UI
- Developer approves → backend invokes Bob in Agent mode: Bob implements the repair
- Bob subagents used where parallel file edits are beneficial

### Stage 6: REVIEW
- Backend invokes Bob in a second independent Agent pass with explicit review instructions
- Bob checks: regressions, security concerns, edge cases, unnecessary changes
- Produces: structured `ReviewResult` (approved / concerns / blocked)

### Stage 7: VERIFY
- Backend re-runs the test suite against the repaired code
- Re-runs ESLint + AST analysis
- Captures new finding counts, test pass/fail counts

### Stage 8: PROVE
- Diff engine computes before/after deltas:
  - Test results: X failing → Y failing
  - Finding counts: N issues → M issues
  - Specific resolved findings
- Produces: `EngineeringReport` (problem, diagnosis, repair plan, changes, review, verification, measurable impact)
- Report is exportable and shown in a dedicated Report page

---

## UI Pages

| Page | Route | Purpose |
|---|---|---|
| Home / Load | `/` | Load a project (path picker), project health summary card |
| Dashboard | `/dashboard` | Project health overview, issue list, filter/sort |
| Issue Detail | `/issue/:id` | Evidence, root cause, impact map, related tests |
| Repair | `/repair/:id` | Bob plan, approve/run, live repair log stream |
| Review | `/review/:id` | Bob review result, concerns list |
| Verify | `/verify/:id` | Test re-run results, new analysis delta |
| Report | `/report/:id` | Full before/after engineering report, export |

---

## IBM Bob Integration — Exact Usage

Bob is invoked via the Bob CLI through `child_process.spawn`. No invented API or SDK is used.

### Bob Plan Mode
Used in Stage 5 to produce the structured repair plan.
- Input: repair brief (plain text with issue, evidence, context)
- Bob is given a specific structured-output instruction
- Output parsed from Bob's response into `RepairPlan` type

### Bob Agent Mode
Used in Stage 5 to implement the repair and Stage 6 to review it.
- Input: the approved repair plan + file context
- Bob executes file edits directly in the target project
- VECTRA monitors progress via stdout streaming

### Bob Subagents
Used in Stage 5 when a repair spans multiple independent files.
- Bob's subagent capability is explicitly requested in the prompt when impact map shows multiple independent files

### Key constraint
Bob's working directory must be set to the target project root so its file tools operate on the correct files.

---

## Sample Application Design

A deliberately imperfect Node.js + Express application simulating a realistic codebase.

### Modules
- `userService.js` — user CRUD with a subtle SQL injection vulnerability
- `authMiddleware.js` — JWT validation with a logic error (wrong condition)
- `dataProcessor.js` — data transformation with an off-by-one error and missing null check
- `emailService.js` — async function with unhandled promise rejection
- `config.js` — hardcoded secret key (security finding)
- `utils/formatDate.js` — function with a timezone handling bug

### Tests (Jest)
- Some passing (covering correct paths)
- Some failing (covering the bugs above)
- Some with missing coverage (untested edge cases)

### Intentional Issues
- 1 security issue (hardcoded secret + SQL injection pattern)
- 2–3 logic bugs (auth condition, off-by-one, null check)
- 1 async error handling gap
- 2–3 code quality/maintainability issues (dead code, overly complex function)

---

## Sub-Tasks (Implementation Order)

### Sub-Task 1: Project Scaffolding
**Status:** [ ] pending

**Intent:** Create the repo structure, install dependencies, configure TypeScript, ESLint, Tailwind, and verify the dev server starts.

**Outcomes:**
- `frontend/` and `backend/` both start with `npm run dev`
- TypeScript compiles with zero errors
- shadcn/ui dark theme renders a test component

**Steps:**
1. Create `frontend/` with `npm create vite@latest` (React + TypeScript)
2. Install Tailwind CSS + shadcn/ui, configure dark mode
3. Create `backend/` with `npm init`, install Express + TypeScript + ts-node-dev
4. Configure shared TypeScript types between frontend and backend
5. Create root `package.json` with `dev`, `build`, `test` scripts that run both
6. Add `.gitignore`, create `data/.gitkeep`

**Relevant files:** `frontend/vite.config.ts`, `backend/tsconfig.json`, root `package.json`

---

### Sub-Task 2: Sample Application
**Status:** [ ] pending

**Intent:** Build the deliberately imperfect Node.js + Express app that VECTRA will demonstrate its workflow on.

**Outcomes:**
- Sample app runs (`node src/index.js`)
- Jest test suite runs: some tests pass, some fail, with clear failure messages
- Contains the documented bugs and security issues

**Steps:**
1. Create `sample-app/` with `package.json`, Jest config
2. Implement the 6 modules listed above with intentional flaws
3. Write Jest tests that exercise both correct and buggy paths
4. Verify: `npm test` inside `sample-app/` shows mixed results

---

### Sub-Task 3: Backend Analysis Engine
**Status:** [ ] pending

**Intent:** Build the deterministic analysis pipeline (Discover → Diagnose → Prioritize).

**Outcomes:**
- `POST /api/analyze` accepts a project path and returns a `FindingList`
- ESLint + AST analysis correctly identifies the sample app's issues
- Findings are scored and prioritized
- Results cached to `data/{projectHash}.json`

**Steps:**
1. Implement `discover.ts` — file tree scan, language/framework detection
2. Implement `eslint-runner.ts` — programmatic ESLint on target files
3. Implement `ast-analyzer.ts` — ts-morph traversal for type/logic issues
4. Implement `test-runner.ts` — spawn Jest, capture structured output
5. Implement scoring/prioritization logic
6. Wire into Express route `POST /api/analyze`
7. Validate against sample-app: all intentional issues detected

---

### Sub-Task 4: Backend Impact Tracer
**Status:** [ ] pending

**Intent:** Build the impact tracing engine (Stage 4).

**Outcomes:**
- `GET /api/impact/:issueId` returns affected files, callers, and related tests
- Impact map is accurate for sample app's SQL injection and auth logic bug

**Steps:**
1. Implement `impact-tracer.ts` using ts-morph reference finding
2. Build call-graph traversal (limited depth, stops at package boundaries)
3. Cross-reference with test file imports to find related tests
4. Wire into Express route

---

### Sub-Task 5: Bob Integration Layer
**Status:** [ ] pending

**Intent:** Build the IBM Bob CLI invocation layer for Plan, Agent, and Review modes.

**Outcomes:**
- `bob-client.ts` can invoke Bob with a given prompt and stream stdout
- `repair-workflow.ts` orchestrates the full repair cycle
- `review-workflow.ts` invokes Bob for independent review
- Tested against the sample app's auth bug

**Steps:**
1. Implement `bob-client.ts` — `child_process.spawn` wrapper with streaming
2. Define prompt templates for Plan mode (structured repair plan output)
3. Define prompt templates for Agent mode (implement repair)
4. Define prompt templates for Review mode (independent review pass)
5. Implement `repair-workflow.ts` orchestrator
6. Implement `review-workflow.ts`
7. Wire into Express routes: `POST /api/repair/plan`, `POST /api/repair/run`, `POST /api/review`

---

### Sub-Task 6: Report Engine
**Status:** [ ] pending

**Intent:** Build the before/after diff and engineering report generator (Stage 8).

**Outcomes:**
- `EngineeringReport` JSON produced after verify stage
- Accurate before/after deltas for test counts and finding counts
- Report is serialized to `data/reports/{id}.json`

**Steps:**
1. Define `EngineeringReport` type
2. Implement diff computation (before snapshot vs after snapshot)
3. Implement report serialization
4. Wire into Express route `GET /api/report/:id`

---

### Sub-Task 7: Frontend Core + Dashboard
**Status:** [ ] pending

**Intent:** Build the main UI — dashboard, project health overview, issue list.

**Outcomes:**
- Premium dark developer-tool UI
- Dashboard loads and displays analysis results
- Issue list is filterable and sorted by priority

**Steps:**
1. Set up React Router, layout shell (sidebar + header)
2. Build Home/Load page (project path input, trigger analysis, progress state)
3. Build Dashboard page (health score card, issue list with severity badges)
4. Create API client hooks (`useAnalysis`, `useIssues`)
5. Ensure all loading/empty/error states are handled

---

### Sub-Task 8: Frontend Issue Detail + Impact Map
**Status:** [ ] pending

**Intent:** Build the Issue Detail page showing evidence, root cause, and impact.

**Outcomes:**
- Issue detail page shows finding evidence, file/line, probable root cause
- Impact map shows affected files and related tests visually

**Steps:**
1. Build Issue Detail page layout
2. Code snippet viewer with highlighted line
3. Impact map component (file tree with affected nodes highlighted)
4. Related tests list

---

### Sub-Task 9: Frontend Repair + Review + Verify Pages
**Status:** [ ] pending

**Intent:** Build the interactive repair workflow pages.

**Outcomes:**
- Repair page shows Bob's plan, approve button, live streaming log
- Review page shows Bob's review result with concern list
- Verify page shows re-run test results and issue delta

**Steps:**
1. Build Repair page with plan display, approve/run control, streaming log panel
2. Build Review page with structured review result display
3. Build Verify page with test result comparison table

---

### Sub-Task 10: Frontend Report Page + Polish
**Status:** [ ] pending

**Intent:** Build the final Report page and apply visual polish across all pages.

**Outcomes:**
- Report page shows complete before/after engineering report
- All pages are visually polished and match the premium design bar
- Animations are smooth but restrained
- All loading, error, and empty states are complete

**Steps:**
1. Build Report page with before/after delta cards, change summary, exportable view
2. Polish pass: typography, spacing, badge colors, transitions
3. Verify demo flow end-to-end: Load → Dashboard → Issue → Repair → Review → Verify → Report

---

## Key Constraints

- **Do not invent Bob API/SDK.** Bob is invoked only via its CLI through `child_process`.
- **Do not invent metrics.** All numbers (test counts, finding counts, deltas) come from actual tool output.
- **Cache analysis results.** Do not re-run full analysis on every page load.
- **Bob is invoked only for reasoning-heavy tasks.** Deterministic tools handle discovery, diagnosis, and verification.
- **Windows-compatible paths.** Use `path.join` everywhere; no hardcoded POSIX paths.
- **Three-teammate structure.** Each teammate can own one of: frontend / backend analysis / Bob integration.

---

## Performance Rules

- Full project analysis runs once and caches; individual lookups read from cache
- Bob is not invoked until the developer explicitly triggers Plan or Repair
- Test runner output is streamed (not buffered) to avoid perceived slowness
- Impact tracer limits call-graph depth to avoid runaway traversal

---

## Definition of Done (Demo Ready)

1. Sample app loads into VECTRA
2. Analysis runs and shows real findings on the Dashboard
3. Developer opens the auth bug issue — sees evidence, file/line, impact map
4. Developer triggers Bob Repair — sees plan, approves, watches Bob implement the fix
5. Bob Review runs and approves the change
6. Tests re-run — failing test now passes
7. Report shows: before (1 failing auth test, 1 security finding) → after (0 failing, 0 security findings)
8. The entire flow takes under 5 minutes in a live demo
