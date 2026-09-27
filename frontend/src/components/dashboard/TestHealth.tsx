import type { TestSuiteResult } from '@/types'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, MinusCircle, FlaskConical } from 'lucide-react'

interface TestHealthProps {
  testResults: TestSuiteResult
}

export function TestHealth({ testResults }: TestHealthProps) {
  const { total, passed, failed } = testResults
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  const allPassing = total > 0 && failed === 0

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-blue-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Test Health</h3>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border',
          total === 0 ? 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]' :
          allPassing ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400' : 'border-red-800/60 bg-red-950/40 text-red-400'
        )}>
          {total === 0 ? (
            <><MinusCircle size={14} /> Not run</>
          ) : allPassing ? (
            <><CheckCircle2 size={14} /> All Passing</>
          ) : (
            <><XCircle size={14} /> {failed} Failing</>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-[hsl(var(--muted))] overflow-hidden mb-6 p-0.5">
        {total > 0 && (
          <div
            className={cn('h-full rounded-full transition-all duration-700', allPassing ? 'bg-emerald-500' : 'bg-red-500')}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Passing Tests', value: passed, color: 'text-emerald-400' },
          { label: 'Failing Tests', value: failed, color: failed > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Total Tests',   value: total,  color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border))] py-3.5 px-2">
            <span className={cn('text-2xl font-extrabold tabular-nums tracking-tight', color)}>{value}</span>
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] text-center">{label}</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <p className="mt-4 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {pct}% pass rate across test suites
        </p>
      )}
    </div>
  )
}
