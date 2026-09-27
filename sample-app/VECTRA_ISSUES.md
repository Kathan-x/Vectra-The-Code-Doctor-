# VECTRA Sample App — Intentional Issues Catalogue

This document is for VECTRA developers only. Do NOT expose this in the running application.

Each issue has an ID that matches the `VECTRA_ISSUE[ID]` annotation in the source file.

---

## Security Issues

| ID | Severity | File | Line | Description |
|---|---|---|---|---|
| SEC-001 | critical | `src/config.js` | 12 | JWT secret hardcoded as string literal. Should use `process.env.JWT_SECRET`. |
| SEC-002 | critical | `src/config.js` | 18 | Database password hardcoded. Should use `process.env.DB_PASSWORD`. |
| BUG-001 | critical | `src/userService.js` | 25 | SQL injection via string concatenation in `getUserByEmail`. Parameterised query required. |

## Logic Bugs

| ID | Severity | File | Line | Description |
|---|---|---|---|---|
| BUG-003 | critical | `src/authMiddleware.js` | 31 | `if (err = null)` — assignment instead of comparison. Auth middleware **always** passes, making all protected routes open to any request with a Bearer token (even invalid/expired ones). |
| BUG-002 | high | `src/userService.js` | 62 | `updateUser` accesses `user.role` without checking if `user` is null. Throws `TypeError: Cannot read properties of null` when user ID not found. |
| BUG-004 | medium | `src/dataProcessor.js` | 32 | `paginateResults` off-by-one: guard is `page > totalPages + 1` instead of `page > totalPages`. Page `totalPages + 1` silently returns empty results instead of a RangeError. |
| BUG-005 | high | `src/dataProcessor.js` | 56 | `summariseScores` does not filter null/undefined values before `reduce`. Calling with `[10, null, 5]` throws `TypeError`. |
| BUG-007 | medium | `src/utils/formatDate.js` | 22 | `formatDate` parses `YYYY-MM-DD` strings as UTC midnight then converts with `toLocaleDateString`, shifting the date backward by one day in UTC- timezones. Fix: `new Date(y, m-1, d)` constructor. |

## Async / Error Handling

| ID | Severity | File | Line | Description |
|---|---|---|---|---|
| BUG-006 | high | `src/emailService.js` | 42 | `sendWelcomeEmail` calls `_dispatchEmail(payload)` without `await` and no `.catch()`. SMTP errors are silently swallowed. Caller receives `{ queued: true }` even when delivery fails. |

## Code Quality / Maintainability

| ID | Severity | File | Lines | Description |
|---|---|---|---|---|
| QUALITY-001 | low | `src/dataProcessor.js` | 74–103 | `calculateStats` mixes filtering, statistics computation, and output formatting in a single function. Should be decomposed. |
| QUALITY-002 | low | `src/emailService.js` | 62 | `legacySendEmail` is dead code — not exported, never called. |

---

## Demo Script (VECTRA walkthrough)

Recommended order for the hackathon demo:

1. **Load** sample-app into VECTRA
2. **DISCOVER** — shows 7 JS files, 3 test files, Jest suite detected
3. **DIAGNOSE** — shows 11 findings including SEC-001, BUG-003, BUG-001
4. **PRIORITIZE** — BUG-003 (auth bypass) ranked #1 due to blast radius
5. **Open BUG-003** — evidence: `if (err = null)`, impact: all `requireAuth` routes
6. **REPAIR** — Bob generates plan, implements `!== null` fix
7. **REVIEW** — Bob review: approved, no regressions
8. **VERIFY** — re-run tests: `authMiddleware.test.js` flips from FAIL to PASS
9. **PROVE** — before: 3 failing tests, 11 findings → after: 0 failing, 10 findings

---

## Expected Test Results (before any repairs)

| Test file | Expected result |
|---|---|
| `userService.test.js` | 5 pass, 1 fail (BUG-002: null deref on missing user) |
| `authMiddleware.test.js` | 3 pass, 2 fail (BUG-003: invalid token should reject but passes) |
| `dataProcessor.test.js` | 4 pass, 2 fail (BUG-004: off-by-one; BUG-005: null crash) |

Total: **12 pass, 5 fail**
