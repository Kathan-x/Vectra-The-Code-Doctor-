import type { PrioritizedIssue } from '@/types'
import { categoryLabel } from '@/lib/tokens'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, FileCode, Shield, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FindingsOverviewProps {
  issues: PrioritizedIssue[]
  maxShown?: number
  onViewAll?: () => void
}

export function FindingsOverview({ issues, maxShown = 5, onViewAll }: FindingsOverviewProps) {
  const navigate = useNavigate()
  const shown = issues.slice(0, maxShown)

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-blue-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Priority Findings</h3>
        </div>
        {issues.length > 0 && (
          <button
            onClick={onViewAll ?? (() => navigate('/issues'))}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            <span>View all {issues.length} issues</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-base font-semibold text-white">Zero findings detected</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This project has no active security or code quality issues.</p>
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {shown.map((issue, idx) => {
            const f = issue.finding
            return (
              <div
                key={issue.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/issues/${issue.id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/issues/${issue.id}`)}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[hsl(var(--muted)/0.4)] transition-colors cursor-pointer group"
              >
                {/* Rank */}
                <span className="w-6 text-center text-sm font-bold tabular-nums text-[hsl(var(--muted-foreground))] shrink-0">
                  #{idx + 1}
                </span>

                {/* Severity badge */}
                <Badge variant={f.severity} className="shrink-0 uppercase text-xs font-semibold px-2.5 py-1">
                  {f.severity}
                </Badge>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors leading-snug truncate">
                    {f.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <FileCode size={13} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                    <span className="text-sm text-[hsl(var(--muted-foreground))] font-mono truncate">
                      {f.file}{f.line ? `:${f.line}` : ''}
                    </span>
                  </div>
                </div>

                {/* Category & Score */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    {categoryLabel[f.category] ?? f.category}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-white bg-[hsl(var(--muted)/0.6)] px-2 py-0.5 rounded border border-[hsl(var(--border))]">
                    score {issue.score}
                  </span>
                </div>

                {/* Chevron */}
                <ChevronRight size={18} className="text-[hsl(var(--muted-foreground))] group-hover:text-white transition-colors shrink-0" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
