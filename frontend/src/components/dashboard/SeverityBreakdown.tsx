import type { SeverityDistribution } from '@/types'
import { cn } from '@/lib/utils'
import { severityColor } from '@/lib/tokens'
import { Shield } from 'lucide-react'

interface SeverityBreakdownProps {
  severity: SeverityDistribution
  total: number
}

const LEVELS = [
  { key: 'critical' as const, label: 'Critical' },
  { key: 'high'     as const, label: 'High'     },
  { key: 'medium'   as const, label: 'Medium'   },
  { key: 'low'      as const, label: 'Low'      },
  { key: 'info'     as const, label: 'Info'     },
]

const BAR_COLOR: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-emerald-500',
  info:     'bg-blue-500',
}

export function SeverityBreakdown({ severity, total }: SeverityBreakdownProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Shield size={18} className="text-blue-400" />
        <h3 className="text-lg font-bold text-white tracking-tight">Severity Breakdown</h3>
      </div>

      {/* Stacked bar */}
      {total > 0 ? (
        <div className="flex h-3 rounded-full overflow-hidden mb-6 gap-0.5 bg-[hsl(var(--muted))] p-0.5">
          {LEVELS.map(({ key }) => {
            const pct = (severity[key] / total) * 100
            if (pct === 0) return null
            return (
              <div
                key={key}
                className={cn('h-full first:rounded-l-full last:rounded-r-full transition-all', BAR_COLOR[key])}
                style={{ width: `${pct}%` }}
                title={`${key}: ${severity[key]}`}
              />
            )
          })}
        </div>
      ) : (
        <div className="h-3 rounded-full bg-[hsl(var(--muted))] mb-6" />
      )}

      {/* Row breakdown */}
      <div className="flex flex-col gap-3">
        {LEVELS.map(({ key, label }) => {
          const count = severity[key] || 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={key} className="flex items-center gap-3">
              <span className={cn('w-20 text-sm font-semibold shrink-0', severityColor[key])}>
                {label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', BAR_COLOR[key])}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-bold tabular-nums text-white">
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
