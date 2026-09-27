/**
 * ImpactPage — /impact
 * Select any real issue to explore its AST call-graph blast radius.
 *
 * Displays: Affected Files | Callers | Callees | Related Tests | Traversal Depth | Confidence
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ImpactMapViz } from '@/components/impact/ImpactMap'
import { ImpactSummary } from '@/components/impact/ImpactSummary'
import { AffectedFiles } from '@/components/issue/AffectedFiles'
import { RelatedTests } from '@/components/issue/RelatedTests'
import { useDashboard } from '@/hooks/useDashboard'
import { useActiveProject } from '@/lib/activeProject'
import { api } from '@/lib/api'
import type { ImpactMap, PrioritizedIssue } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitBranch, FileCode, ChevronRight, Loader2, AlertTriangle,
  ExternalLink, Search, RefreshCw, CheckCircle2, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ImpactPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { project } = useActiveProject()
  const { state, analyze } = useDashboard(project.path)
  const { status, report } = state

  const [selectedIssue, setSelectedIssue] = useState<PrioritizedIssue | null>(null)
  const [impactMap, setImpactMap] = useState<ImpactMap | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [impactError, setImpactError] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  const rawIssues = report?.snapshot.prioritizedIssues
  const issues = useMemo(() => rawIssues ?? [], [rawIssues])

  const filteredIssues = useMemo(() => {
    if (!filterQuery.trim()) return issues
    const q = filterQuery.toLowerCase()
    return issues.filter(i =>
      i.finding.title.toLowerCase().includes(q) ||
      i.finding.file.toLowerCase().includes(q)
    )
  }, [issues, filterQuery])

  // Function to load impact
  const selectIssue = useCallback(async (issue: PrioritizedIssue) => {
    setSelectedIssue(issue)
    setImpactMap(null)
    setImpactError(null)
    setImpactLoading(true)
    try {
      const map = await api.getImpact(issue.id, project.path)
      setImpactMap(map)
    } catch (err) {
      setImpactError((err as Error).message || 'Failed to trace impact for this symbol.')
    } finally {
      setImpactLoading(false)
    }
  }, [project.path])

  // Auto-select issue from URL query parameter or default to top issue
  useEffect(() => {
    const urlIssueId = searchParams.get('issueId')
    if (urlIssueId && issues.length > 0) {
      const match = issues.find(i => i.id === urlIssueId)
      if (match && match.id !== selectedIssue?.id) {
        void selectIssue(match)
      }
    } else if (!selectedIssue && issues.length > 0) {
      void selectIssue(issues[0])
    }
  }, [searchParams, issues, selectedIssue, selectIssue])

  const isLoading = status === 'loading' || status === 'analyzing'

  return (
    <AppLayout
      report={report}
      isAnalyzing={status === 'analyzing'}
      onAnalyze={() => analyze()}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page header */}
        <div className="pb-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
              Target Project · {project.displayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
            Impact &amp; Blast Radius Tracer
          </h1>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
            AST-level call graph analysis mapping callers, callees, and affected files
          </p>
        </div>

        {/* Idle / unanalyzed state */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 max-w-md mx-auto">
            <GitBranch size={36} className="text-blue-400" />
            <div>
              <p className="text-lg font-bold text-white mb-1">No Analysis Completed</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Analyze <strong className="text-white">{project.displayName}</strong> to generate the AST call graph.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => analyze()} className="gap-2 cursor-pointer">
              <RefreshCw size={14} />
              Run Analysis Now
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading project call graph…</span>
          </div>
        )}

        {/* Ready with zero issues */}
        {status === 'ready' && report && issues.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center rounded-xl border border-emerald-800/40 bg-emerald-950/15 p-8 max-w-lg mx-auto">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <div>
              <p className="text-base font-bold text-white mb-1">No Diagnostic Findings to Trace</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                <strong className="text-white">{project.displayName}</strong> has zero detected defect symbols. The call graph blast radius is completely clear.
              </p>
            </div>
          </div>
        )}

        {status === 'ready' && report && issues.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

            {/* Left Column: Finding Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Select Finding ({issues.length})
                </h2>
              </div>

              {/* Filter input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="Filter findings…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-white placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-blue-500"
                />
              </div>

              {/* Finding list */}
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border)/0.6)] overflow-hidden max-h-[64vh] overflow-y-auto shadow-xs">
                {filteredIssues.map((issue) => {
                  const f = issue.finding
                  const isSelected = selectedIssue?.id === issue.id
                  return (
                    <button
                      key={issue.id}
                      onClick={() => selectIssue(issue)}
                      aria-pressed={isSelected}
                      className={cn(
                        'w-full flex items-start gap-2.5 p-3 text-left transition-all cursor-pointer',
                        isSelected
                          ? 'bg-blue-950/40 border-l-3 border-l-blue-500'
                          : 'hover:bg-[hsl(var(--muted)/0.35)]'
                      )}
                    >
                      <Badge variant={f.severity} className="shrink-0 mt-0.5 uppercase text-[9px] font-bold px-1.5 py-0.2">
                        {f.severity.slice(0, 4)}
                      </Badge>
                      <div className="flex-1 min-w-0 pr-1">
                        <p className={cn(
                          'text-xs font-semibold truncate leading-snug',
                          isSelected ? 'text-blue-400' : 'text-white'
                        )}>
                          {f.title}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono mt-0.5 flex items-center gap-1 truncate">
                          <FileCode size={11} className="shrink-0" />
                          <span>{f.file}{f.line ? `:${f.line}` : ''}</span>
                        </p>
                      </div>
                      <ChevronRight size={14} className={isSelected ? 'text-blue-400' : 'text-[hsl(var(--muted-foreground))]'} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right Column: Impact Visualization */}
            <div className="space-y-5">
              {selectedIssue && (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedIssue.finding.severity} className="uppercase text-[10px] font-bold px-2 py-0.5">
                        {selectedIssue.finding.severity}
                      </Badge>
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                        Priority Score: <strong className="text-white">{selectedIssue.score}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/issues/${selectedIssue.id}`)}
                        className="gap-1.5 text-xs cursor-pointer"
                      >
                        <span>Diagnostic View</span>
                        <ExternalLink size={12} />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/repair?issueId=${selectedIssue.id}`)}
                        className="gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Wrench size={13} />
                        <span>Launch Repair</span>
                      </Button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {selectedIssue.finding.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                    <FileCode size={13} className="text-blue-400 shrink-0" />
                    <span>{selectedIssue.finding.file}:{selectedIssue.finding.line}</span>
                  </div>
                </div>
              )}

              {impactLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))]">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span className="text-xs font-medium">Tracing symbol references across project AST…</span>
                </div>
              )}

              {impactError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-800/40 bg-red-950/20 p-4">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">Impact Tracing Notice</p>
                    <p className="text-xs text-red-200 mt-0.5">{impactError}</p>
                  </div>
                </div>
              )}

              {impactMap && !impactLoading && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">
                    <div className="space-y-5">
                      <ImpactMapViz impactMap={impactMap} findingTitle={selectedIssue?.finding.title ?? ''} />
                      <AffectedFiles impactMap={impactMap} />
                    </div>
                    <ImpactSummary impactMap={impactMap} />
                  </div>

                  <RelatedTests
                    issueTests={selectedIssue?.relatedTests ?? []}
                    impactTests={impactMap.relatedTests}
                    hasFailingTest={selectedIssue?.hasFailingTest ?? false}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
