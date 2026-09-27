import { FlaskConical, AlertTriangle } from 'lucide-react'

interface RelatedTestsProps {
  /** Tests from the prioritized issue (static correlation) */
  issueTests: string[]
  /** Tests from the impact map (AST-traced) */
  impactTests?: string[]
  hasFailingTest?: boolean
}

export function RelatedTests({ issueTests, impactTests = [], hasFailingTest }: RelatedTestsProps) {
  // Merge and deduplicate
  const all = Array.from(new Set([...issueTests, ...impactTests]))

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)]">
        <div className="flex items-center gap-2.5">
          <FlaskConical size={18} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-0.5 rounded">
            5. Related Tests
          </span>
          <h2 className="text-base font-bold text-white">Test Coverage &amp; Verification Scope</h2>
        </div>

        {all.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            {all.length} test suite{all.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="p-6 space-y-4">
        {hasFailingTest && (
          <div className="flex items-start gap-2.5 text-xs text-red-300 bg-red-950/30 border border-red-800/40 p-3 rounded-xl">
            <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p>
              <strong>Failing Test Correlated:</strong> Automated tests covering this code path currently fail. Repairing this defect is required to restore passing tests.
            </p>
          </div>
        )}

        {all.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No related test files detected for this code segment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {all.map(t => {
              const fromImpact = impactTests.includes(t)
              const fromIssue  = issueTests.includes(t)
              return (
                <div
                  key={t}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FlaskConical size={15} className="text-blue-400 shrink-0" />
                    <span className="text-sm font-mono text-white truncate">{t}</span>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-900/40 shrink-0">
                    {fromImpact && fromIssue ? 'AST + Static' : fromImpact ? 'AST Traced' : 'Static'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
