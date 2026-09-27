import type { PrioritizedIssue } from '@/types'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileCode, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

interface IssueHeaderProps {
  issue: PrioritizedIssue
  rank?: number
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  security: 'Security Vulnerability',
  bug:      'Logic Defect',
  async:    'Asynchronous / Error Handling',
  quality:  'Code Quality & Maintainability',
  test:     'Test Coverage Gap',
}

export function IssueHeader({ issue, rank }: IssueHeaderProps) {
  const navigate = useNavigate()
  const { finding, score } = issue

  return (
    <div className="space-y-4">
      {/* Navigation breadcrumb */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/issues')}
          className="gap-2 -ml-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-white"
        >
          <ArrowLeft size={15} />
          <span>Back to Issues Explorer</span>
        </Button>
      </div>

      {/* Section 1: WHAT IS WRONG? */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-3 py-1 rounded-md">
              1. What Is Wrong?
            </span>
            <Badge variant={finding.severity} className="uppercase text-xs font-semibold px-3 py-1">
              {finding.severity}
            </Badge>
            <span className="text-xs font-semibold px-3 py-1 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.4)]">
              {CATEGORY_DESCRIPTIONS[finding.category] ?? finding.category}
            </span>
            {finding.ruleId && (
              <span className="text-xs font-mono text-blue-300 bg-blue-950/30 border border-blue-900/40 px-2.5 py-1 rounded-md">
                {finding.ruleId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {score > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-bold tabular-nums text-white bg-[hsl(var(--muted)/0.7)] border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg">
                <Star size={13} className="text-amber-400 fill-amber-400" />
                <span>Priority {score}</span>
              </span>
            )}
            {rank !== undefined && (
              <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                Rank #{rank + 1}
              </span>
            )}
          </div>
        </div>

        {/* Main Issue Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
          {finding.title}
        </h1>

        {/* Location & Quick Alert */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[hsl(var(--muted-foreground))] pt-1">
          <span className="flex items-center gap-2 font-mono text-white bg-[hsl(var(--muted)/0.4)] px-3 py-1 rounded-md border border-[hsl(var(--border))]">
            <FileCode size={14} className="text-blue-400" />
            <span>{finding.file}{finding.line ? `:${finding.line}` : ''}</span>
          </span>

          {issue.hasFailingTest && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-400 bg-red-950/30 border border-red-800/40 px-3 py-1 rounded-md">
              <AlertTriangle size={14} />
              <span>Correlated to Failing Test</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
