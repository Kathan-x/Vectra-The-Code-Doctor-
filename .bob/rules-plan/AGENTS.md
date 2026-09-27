# AGENTS.md — Plan Mode

Architectural constraints for planning VECTRA changes.

## Hard Architectural Constraints

- **Bob is stateless from VECTRA's perspective.** Each `runBob()` call is an independent `@cursor/sdk` Agent session. Do not design flows that require Bob to remember previous context across separate API requests — pass all necessary context in each prompt.
- **No rollback on analysis cache.** The cache is write-once per `{md5(projectPath)}.json`. If re-analysis is needed, set `force: true` in the `AnalyzeRequest` or delete the cache file — there is no partial-update mechanism.
- **Impact tracer is depth-limited.** Call-graph traversal stops at configurable depth (default 3). Do not plan features that assume complete transitive impact coverage.
- **Test runner is a subprocess.** Target project tests run in a child process (`node <jestBin> --json`). VECTRA cannot inject code into the test run or intercept it mid-execution.
- **Frontend never touches `@cursor/sdk`.** All Bob interactions are gated through `backend/src/bob/bob-client.ts`. The frontend only calls VECTRA's REST API (`/api/repair/...`).
- **Three-directory ownership.** `frontend/`, `backend/`, and `sample-app/` are designed to be worked on independently. Plans requiring simultaneous changes across all three should be avoided unless truly necessary.
- **Types: manual mirror.** There is no type code-gen between `backend/src/types/` and `frontend/src/types/index.ts`. Plans that add new domain types must account for updating both files.
- **Tailwind v4 — no config file.** All Tailwind customisation is via CSS custom properties in `frontend/src/index.css`. Plans must not include `tailwind.config.js` creation or `@apply` directives outside `index.css`.
- **shadcn/ui components are hand-written.** The `shadcn-ui` CLI is broken with Tailwind v4. Any plan to "install a shadcn component" means writing it by hand in `frontend/src/components/ui/`.

## Stage Ordering Constraint

The 8 stages are sequential per issue. REPAIR cannot run before DIAGNOSE completes; PROVE cannot run before VERIFY completes. Plans must respect this dependency chain.

## Bobcoin Budget

- Deterministic analysis (stages 1–3, 7) and impact tracing (stage 4) use zero AI tokens.
- Bob is invoked at most twice per repair cycle: once for Plan + Agent (stage 5 via `repair-workflow.ts`), once for Review (stage 6 via `review-workflow.ts`).
- `maxTurns` caps are: plan=5, repair=15, review=5. Do not plan features that increase these without strong justification.
- Do not plan additional Bob invocations for analysis, discovery, or verification — those stages are deterministic by design.

## Verification Commands (safe to run in plans)

```bash
cd backend  && npx tsc --noEmit        # typecheck
cd frontend && npx tsc -b --noEmit     # typecheck
cd backend  && npm run build           # compile to dist/
cd frontend && npm run build           # vite build
cd backend  && npx ts-node --transpile-only src/scripts/smoke-test.ts  # validate analysis engine
```

Never include `npm run dev` or `ts-node-dev` in a verification plan — they are long-running processes that never exit.
