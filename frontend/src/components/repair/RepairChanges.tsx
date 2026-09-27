import type { RepairPlan } from '@/types'
import { FileCode, CheckSquare } from 'lucide-react'

interface RepairChangesProps {
  plan: RepairPlan
}

const STEP_TYPE_LABEL: Record<string, string> = {
  edit:   'Modified',
  add:    'Added',
  delete: 'Removed',
  rename: 'Renamed',
}

const STEP_TYPE_COLOR: Record<string, string> = {
  edit:   'text-blue-400',
  add:    'text-green-400',
  delete: 'text-red-400',
  rename: 'text-yellow-400',
}

export function RepairChanges({ plan }: RepairChangesProps) {
  // Deduplicate files changed
  const uniqueFiles = Array.from(new Set(plan.steps.map(s => s.file)))

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <CheckSquare size={14} className="text-green-400" />
        <h2 className="text-sm font-semibold text-white">Repair Applied</h2>
        <span className="ml-auto text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {uniqueFiles.length} file{uniqueFiles.length !== 1 ? 's' : ''} modified
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Summary */}
        <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">{plan.summary}</p>

        {/* Per-file changes */}
        <div className="space-y-2">
          {plan.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5 bg-[hsl(var(--muted)/0.2)]">
              <FileCode size={12} className={`${STEP_TYPE_COLOR[step.type] ?? 'text-white'} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-mono text-white break-all">{step.file}</span>
                  <span className={`text-[9px] font-medium ${STEP_TYPE_COLOR[step.type] ?? 'text-white'}`}>
                    {STEP_TYPE_LABEL[step.type] ?? step.type}
                  </span>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Note about actual diff */}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic">
          Exact file changes were applied by IBM Bob. Run independent review to inspect the result.
        </p>
      </div>
    </div>
  )
}
