import { cn } from '@/lib/utils'
import { Check, Circle } from 'lucide-react'

export type WorkflowStep =
  | 'discover'
  | 'diagnose'
  | 'impact'
  | 'repair'
  | 'review'
  | 'verify'
  | 'report'

const STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'diagnose', label: 'Diagnose' },
  { id: 'impact',   label: 'Impact'   },
  { id: 'repair',   label: 'Repair'   },
  { id: 'review',   label: 'Review'   },
  { id: 'verify',   label: 'Verify'   },
  { id: 'report',   label: 'Prove'    },
]

interface WorkflowIndicatorProps {
  /** The currently active step */
  current: WorkflowStep
  /** Steps that are fully complete */
  completed?: WorkflowStep[]
  className?: string
}

export function WorkflowIndicator({ current, completed = [], className }: WorkflowIndicatorProps) {
  const currentIdx  = STEPS.findIndex(s => s.id === current)

  return (
    <div className={cn('flex items-center gap-0 overflow-x-auto', className)} role="navigation" aria-label="Workflow progress">
      {STEPS.map(({ id, label }, i) => {
        const isDone    = completed.includes(id) || i < currentIdx
        const isActive  = id === current
        const isFuture  = i > currentIdx && !completed.includes(id)

        return (
          <div key={id} className="flex items-center shrink-0">
            {/* Step */}
            <div className="flex flex-col items-center gap-1">
              <div
                aria-label={`${label}: ${isDone ? 'complete' : isActive ? 'in progress' : 'pending'}`}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center border transition-colors',
                  isDone
                    ? 'border-green-600 bg-green-950/80 text-green-400'
                    : isActive
                    ? 'border-blue-500 bg-blue-950/80 text-blue-400'
                    : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted-foreground))]'
                )}
              >
                {isDone
                  ? <Check size={11} strokeWidth={2.5} />
                  : <Circle size={7} fill="currentColor" />
                }
              </div>
              <span className={cn(
                'text-[10px] font-medium whitespace-nowrap',
                isDone   ? 'text-green-400' :
                isActive ? 'text-blue-400'  :
                           'text-[hsl(var(--muted-foreground))]',
                isFuture && 'opacity-50'
              )}>
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-6 h-px mx-0.5 mb-5 transition-colors',
                isDone ? 'bg-green-700' : 'bg-[hsl(var(--border))]'
              )} aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}
