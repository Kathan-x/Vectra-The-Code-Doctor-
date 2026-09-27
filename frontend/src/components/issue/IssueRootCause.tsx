import type { Finding } from '@/types'
import { Lightbulb, AlertTriangle, Zap } from 'lucide-react'

const ROOT_CAUSE_MAP: Record<string, { what: string; why: string; consequence: string }> = {
  'vectra/no-assign-in-condition': {
    what: 'An assignment operator (=) is used inside an if-condition instead of a comparison operator (!==, ===, ==).',
    why: 'JavaScript allows assignments inside conditions without a syntax error. The assigned value becomes the condition result, meaning the branch logic is driven entirely by the assignment rather than checking the error state.',
    consequence: 'The condition always evaluates as falsy (null is falsy), so the error-handling branch never executes. Any invalid or tampered token is accepted as valid, leading to complete authentication bypass.',
  },
  'vectra/no-hardcoded-secret': {
    what: 'A cryptographic secret or password is embedded as an immutable string literal directly in source code.',
    why: 'Secrets written in source code are committed into version control, visible in build artifacts, and cannot be rotated without code modification and re-deployment.',
    consequence: 'Anyone with repository read access can extract the key, forge arbitrary JWT signatures, impersonate administrative users, or access databases directly.',
  },
  'vectra/no-sql-concat': {
    what: 'A database query is constructed using dynamic string concatenation with unescaped input parameters.',
    why: 'The database engine receives raw concatenated strings without separating the query syntax from user-supplied data values.',
    consequence: 'Attackers can manipulate input parameters to execute arbitrary SQL commands, potentially exfiltrating sensitive data, modifying records, or dropping tables.',
  },
  'vectra/null-deref': {
    what: 'A property is accessed on an object reference without first verifying that the object is not null or undefined.',
    why: 'The object is populated from an asynchronous database query or API call that returns null when an entity is not found.',
    consequence: "Throws a runtime TypeError ('Cannot read properties of null'), immediately terminating the request with an unhandled exception and 500 Internal Server Error.",
  },
  'vectra/no-floating-async': {
    what: 'An asynchronous function is invoked without an await expression and without an attached .catch() rejection handler.',
    why: 'Without awaiting or catching, asynchronous rejections bubble outside the execution flow and are discarded by the runtime.',
    consequence: 'Failures in downstream services (e.g. email delivery, payment dispatch) occur silently without notifying callers or surfacing in application logs.',
  },
  'vectra/async-no-error-boundary': {
    what: 'An asynchronous function performs multiple awaited operations without a surrounding try/catch error boundary.',
    why: 'If any awaited promise rejects, the entire function terminates abruptly with an unhandled promise rejection.',
    consequence: 'Downstream cleanup code is skipped, database connections may leak, and callers receive unhandled rejection errors.',
  },
  'vectra/dead-code': {
    what: 'A function or symbol is defined in a file but never called, exported, or referenced across the codebase.',
    why: 'Residual code left behind following refactoring or deprecation without cleanup.',
    consequence: 'Increases cognitive load, inflates bundle size, and can create confusion during future maintenance.',
  },
  'security/detect-object-injection': {
    what: 'Object properties are accessed or modified using unvalidated dynamic string keys from user input.',
    why: 'Dynamic property keys can access prototype attributes such as __proto__ or constructor.',
    consequence: 'May permit prototype pollution attacks, altering object behavior process-wide and compromising application security.',
  },
}

const FALLBACK: { what: string; why: string; consequence: string } = {
  what: 'The static analyzer detected an anti-pattern or vulnerability at this AST node.',
  why: 'This pattern deviates from verified safe engineering standards and introduces defect risk.',
  consequence: 'Can cause runtime exceptions, unexpected logic branches, or security exposure.',
}

export function IssueRootCause({ finding }: { finding: Finding }) {
  const cause = (finding.ruleId && ROOT_CAUSE_MAP[finding.ruleId]) ? ROOT_CAUSE_MAP[finding.ruleId] : FALLBACK

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)]">
        <Lightbulb size={18} className="text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-0.5 rounded">
          3. Root Cause
        </span>
        <h2 className="text-base font-bold text-white">Engineering Diagnostic Analysis</h2>
      </div>

      <div className="p-6 space-y-4">
        {/* What happens */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            <Zap size={13} />
            <span>The Defect</span>
          </div>
          <p className="text-sm text-white leading-relaxed">
            {cause.what}
          </p>
        </div>

        {/* Why it happens */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Lightbulb size={13} />
            <span>Underlying Mechanism</span>
          </div>
          <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
            {cause.why}
          </p>
        </div>

        {/* Consequence */}
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
            <AlertTriangle size={13} />
            <span>Systemic Consequence</span>
          </div>
          <p className="text-sm text-red-200 leading-relaxed">
            {cause.consequence}
          </p>
        </div>
      </div>
    </div>
  )
}
