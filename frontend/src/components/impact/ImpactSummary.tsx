import type { ImpactMap } from '@/types'
import { Activity } from 'lucide-react'

interface ImpactSummaryProps {
  impactMap: ImpactMap
}

const CONFIDENCE_LABEL: Record<ImpactMap['confidence'], string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

const CONFIDENCE_COLOR: Record<ImpactMap['confidence'], string> = {
  high:   'text-green-400',
  medium: 'text-yellow-400',
  low:    'text-orange-400',
}

export function ImpactSummary({ impactMap }: ImpactSummaryProps) {
  const { affectedFiles, callers, callees, relatedTests, confidence, depth } = impactMap

  const stats: Array<{ label: string; value: number | string; sub?: string }> = [
    { label: 'Affected files',  value: affectedFiles.length },
    { label: 'Callers',         value: callers.length },
    { label: 'Callees',         value: callees.length },
    { label: 'Related tests',   value: relatedTests.length },
    { label: 'Traversal depth', value: depth },
  ]

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <Activity size={14} className="text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-white">Impact Summary</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Confidence */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[hsl(var(--muted-foreground))]">Confidence</span>
          <span className={`font-medium ${CONFIDENCE_COLOR[confidence]}`}>
            {CONFIDENCE_LABEL[confidence]}
          </span>
        </div>

        <div className="border-t border-[hsl(var(--border))]" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] px-3 py-2">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
              <p className="text-sm font-semibold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
