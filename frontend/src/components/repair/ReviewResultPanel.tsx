import type { ReviewResult } from '@/types'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldAlert, ShieldX, AlertCircle } from 'lucide-react'

interface ReviewResultPanelProps {
  review: ReviewResult
}

const STATUS_CONFIG = {
  approved: {
    icon:    <ShieldCheck size={16} className="text-green-400" />,
    label:   'Approved',
    style:   'border-green-800/50 bg-green-950/20',
    text:    'text-green-400',
  },
  concerns: {
    icon:    <ShieldAlert size={16} className="text-yellow-400" />,
    label:   'Concerns',
    style:   'border-yellow-800/50 bg-yellow-950/20',
    text:    'text-yellow-400',
  },
  blocked: {
    icon:    <ShieldX size={16} className="text-red-400" />,
    label:   'Blocked',
    style:   'border-red-800/50 bg-red-950/20',
    text:    'text-red-400',
  },
}

export function ReviewResultPanel({ review }: ReviewResultPanelProps) {
  const config = STATUS_CONFIG[review.status] ?? STATUS_CONFIG.concerns

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        {config.icon}
        <h2 className="text-sm font-semibold text-white">Independent Review</h2>
        <span className={`ml-auto text-xs font-medium ${config.text}`}>{config.label}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Status banner */}
        <div className={`rounded-lg border px-3 py-2.5 ${config.style}`}>
          <p className={`text-xs font-medium ${config.text}`}>{review.summary}</p>
        </div>

        {/* Concerns */}
        {review.concerns.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
              Concerns ({review.concerns.length})
            </p>
            <div className="space-y-2">
              {review.concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5 bg-[hsl(var(--muted)/0.2)]">
                  <AlertCircle size={12} className="text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        variant={c.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                        className="uppercase text-[9px]"
                      >
                        {c.severity}
                      </Badge>
                      {c.file && (
                        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                          {c.file}{c.line ? `:${c.line}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          review.status === 'approved' && (
            <p className="text-xs text-green-400">No concerns raised. The repair looks correct.</p>
          )
        )}
      </div>
    </div>
  )
}
