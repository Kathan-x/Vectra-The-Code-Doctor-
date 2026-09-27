import type { RepairPlan } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, FileCode, AlertTriangle, Play } from 'lucide-react'

interface RepairPlanPanelProps {
  plan: RepairPlan
  issueTitle: string
  issueSeverity: string
  onApprove: () => void
  onDiscard: () => void
  disabled?: boolean
}

const RISK_STYLE: Record<string, string> = {
  low:    'text-green-400 border-green-800/50 bg-green-950/30',
  medium: 'text-yellow-400 border-yellow-800/50 bg-yellow-950/30',
  high:   'text-red-400 border-red-800/50 bg-red-950/30',
}

const STEP_TYPE_COLOR: Record<string, string> = {
  edit:   'text-blue-400 bg-blue-950/30 border-blue-800/40',
  add:    'text-green-400 bg-green-950/30 border-green-800/40',
  delete: 'text-red-400 bg-red-950/30 border-red-800/40',
  rename: 'text-yellow-400 bg-yellow-950/30 border-yellow-800/40',
}

export function RepairPlanPanel({
  plan,
  issueTitle,
  issueSeverity,
  onApprove,
  onDiscard,
  disabled = false,
}: RepairPlanPanelProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <ClipboardList size={14} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-white">Repair Plan</h2>
        <span
          className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded border ${RISK_STYLE[plan.estimatedRisk] ?? RISK_STYLE.medium}`}
        >
          {plan.estimatedRisk} risk
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Target issue summary */}
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-3 py-2.5">
          <AlertTriangle size={13} className="text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5 uppercase tracking-wide">Target issue</p>
            <p className="text-xs text-white font-medium leading-snug break-words">
              <Badge variant={issueSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info'} className="mr-1.5 uppercase text-[9px]">
                {issueSeverity}
              </Badge>
              {issueTitle}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">Plan summary</p>
          <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">{plan.summary}</p>
        </div>

        {/* Steps */}
        {plan.steps.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
              Changes ({plan.steps.length})
            </p>
            <div className="space-y-2">
              {plan.steps.map((step, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5 bg-[hsl(var(--muted)/0.2)]">
                  <span className="w-5 text-center text-[10px] tabular-nums text-[hsl(var(--muted-foreground))] pt-0.5 shrink-0">{step.order}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                        <FileCode size={10} />
                        {step.file}
                      </span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${STEP_TYPE_COLOR[step.type] ?? STEP_TYPE_COLOR.edit}`}>
                        {step.type}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-[hsl(var(--border))]">
          <Button
            variant="default"
            size="sm"
            onClick={onApprove}
            disabled={disabled}
            className="gap-1.5 flex-1"
          >
            <Play size={12} />
            Apply Repair
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            disabled={disabled}
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}
