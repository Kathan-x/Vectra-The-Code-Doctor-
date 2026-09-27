/**
 * IssuesPage — /issues
 * Full scan-friendly list of real findings from active project analysis.
 *
 * Columns: Severity | Issue | Category | File | Line | Priority
 * Filters: All | Critical | High | Medium | Low + Search query
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/hooks/useDashboard'
import { useActiveProject } from '@/lib/activeProject'
import type { Severity, PrioritizedIssue } from '@/types'
import { categoryLabel, severityColor } from '@/lib/tokens'
import { Shield, FileCode, ChevronRight, Loader2, AlertTriangle, Search, RefreshCw, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEVERITY_FILTERS: Array<{ key: Severity | 'all'; label: string }> = [
  { key: 'all',      label: 'All Issues' },
  { key: 'critical', label: 'Critical'   },
  { key: 'high',     label: 'High'       },
  { key: 'medium',   label: 'Medium'     },
  { key: 'low',      label: 'Low'        },
]

export default function IssuesPage() {
  const navigate = useNavigate()
  const { project } = useActiveProject()
  const { state, analyze } = useDashboard(project.path)
  const { status, report, error } = state

  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [query, setQuery] = useState('')

  const rawIssues = report?.snapshot.prioritizedIssues
  const issues: PrioritizedIssue[] = useMemo(() => rawIssues ?? [], [rawIssues])

  // Count by severity
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: issues.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const issue of issues) {
      const sev = issue.finding.severity
      c[sev] = (c[sev] || 0) + 1
    }
    return c
  }, [issues])

  const filtered = useMemo(() => {
    let result = issues
    if (filter !== 'all') result = result.filter(i => i.finding.severity === filter)
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(i =>
        i.finding.title.toLowerCase().includes(q) ||
        i.finding.file.toLowerCase().includes(q) ||
        (i.finding.ruleId ?? '').toLowerCase().includes(q) ||
        (i.finding.category ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [issues, filter, query])

  const isAnalyzing = status === 'analyzing'
  const isLoading   = status === 'loading'

  return (
    <AppLayout
      report={report}
      isAnalyzing={isAnalyzing}
      onAnalyze={() => analyze()}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-[hsl(var(--border))]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                Target Project · {project.displayName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
              Issues Explorer
            </h1>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
              Ranked by severity, AST blast radius, and test failure correlation
            </p>
          </div>

          {report && (
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-3 py-1.5 rounded-lg">
                <span className="tabular-nums font-bold text-white mr-1.5">{issues.length}</span>
                total findings
              </span>
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading issues from analysis cache…</span>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border border-red-800/40 bg-red-950/20 p-8 max-w-md mx-auto">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-base font-bold text-white">Analysis Data Unavailable</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{error}</p>
            <Button variant="default" size="sm" onClick={() => analyze(true)} className="gap-2 mt-2 cursor-pointer">
              <RefreshCw size={14} />
              Retry Analysis
            </Button>
          </div>
        )}

        {/* No analysis yet */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 max-w-md mx-auto">
            <Shield size={36} className="text-blue-400" />
            <div>
              <p className="text-lg font-bold text-white mb-1">No Analysis Completed</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Run analysis on <strong className="text-white">{project.displayName}</strong> to discover engineering issues.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => analyze()} className="gap-2 cursor-pointer">
              <RefreshCw size={14} />
              Analyze Project Now
            </Button>
          </div>
        )}

        {/* Issues List & Controls */}
        {status === 'ready' && report && (
          <div className="space-y-5">
            {/* Filter pills & Search box */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Severity filter buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                {SEVERITY_FILTERS.map(({ key, label }) => {
                  const count = counts[key] ?? 0
                  const isSelected = filter === key
                  return (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--muted))]'
                      )}
                    >
                      <span>{label}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono',
                        isSelected ? 'bg-blue-700 text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                      )}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search input */}
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search issue title, file, rule ID…"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-white placeholder:text-[hsl(var(--muted-foreground))] focus:border-blue-500 outline-none transition-colors"
                  aria-label="Filter issues"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Issues Table */}
            {issues.length === 0 ? (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/15 px-6 py-16 text-center">
                <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-base font-bold text-white mb-1">Zero Findings Detected</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
                  <strong className="text-white">{project.displayName}</strong> passed all AST pattern checks, security lint rules, and code quality verifications cleanly.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-16 text-center">
                <Shield size={32} className="text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
                <p className="text-sm font-semibold text-white mb-0.5">No issues match the current filter</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Try clearing the search query or selecting &ldquo;All Issues&rdquo;.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-xs">
                {/* Column Headers: Severity | Issue | Category | File | Line | Priority */}
                <div className="grid grid-cols-[90px_1fr_110px_200px_70px_80px_32px] gap-3 px-5 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <span>Severity</span>
                  <span>Issue</span>
                  <span>Category</span>
                  <span>File</span>
                  <span className="text-center">Line</span>
                  <span className="text-right">Priority</span>
                  <span />
                </div>

                {/* Rows */}
                <div className="divide-y divide-[hsl(var(--border)/0.7)]">
                  {filtered.map(issue => {
                    const f = issue.finding
                    return (
                      <button
                        key={issue.id}
                        onClick={() => navigate(`/issues/${issue.id}`)}
                        className="w-full grid grid-cols-[90px_1fr_110px_200px_70px_80px_32px] gap-3 items-center px-5 py-3 hover:bg-[hsl(var(--muted)/0.35)] transition-colors text-left cursor-pointer group"
                        aria-label={`Open issue: ${f.title}`}
                      >
                        {/* 1. Severity */}
                        <div>
                          <Badge variant={f.severity} className="uppercase text-[10px] font-bold px-2 py-0.5">
                            {f.severity}
                          </Badge>
                        </div>

                        {/* 2. Issue */}
                        <div className="min-w-0 pr-2">
                          <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                            {f.title}
                          </p>
                          {f.ruleId && (
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono truncate">
                              {f.ruleId}
                            </p>
                          )}
                        </div>

                        {/* 3. Category */}
                        <div>
                          <span className={cn('text-xs font-semibold capitalize', severityColor[f.severity])}>
                            {categoryLabel[f.category] ?? f.category}
                          </span>
                        </div>

                        {/* 4. File */}
                        <div className="flex items-center gap-1.5 min-w-0 text-xs font-mono text-[hsl(var(--muted-foreground))] truncate">
                          <FileCode size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                          <span className="truncate" title={f.file}>{f.file}</span>
                        </div>

                        {/* 5. Line */}
                        <div className="text-center text-xs font-mono text-[hsl(var(--muted-foreground))] tabular-nums">
                          {f.line ? `:${f.line}` : '—'}
                        </div>

                        {/* 6. Priority */}
                        <div className="text-right">
                          <span className="inline-block text-xs font-bold tabular-nums text-white bg-[hsl(var(--muted)/0.6)] px-2 py-0.5 rounded border border-[hsl(var(--border))] font-mono">
                            {issue.score}
                          </span>
                        </div>

                        {/* 7. Action Arrow */}
                        <div className="flex justify-end">
                          <ChevronRight size={15} className="text-[hsl(var(--muted-foreground))] group-hover:text-white transition-colors" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
