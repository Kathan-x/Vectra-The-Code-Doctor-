/**
 * RepairPage — /repair
 * Select any real issue and launch the IBM Bob 4-stage guided repair workflow:
 * 1. PLAN → 2. REPAIR → 3. REVIEW → 4. VERIFY
 */

import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RepairWorkflow } from '@/components/repair/RepairWorkflow'
import { useDashboard } from '@/hooks/useDashboard'
import { useActiveProject } from '@/lib/activeProject'
import type { AnalysisSnapshot } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wrench, FileCode, ChevronRight, Loader2, RefreshCw, Search, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function RepairPage() {
  const [searchParams] = useSearchParams()
  const { project } = useActiveProject()
  const { state, analyze, reload } = useDashboard(project.path)
  const { status, report } = state

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')

  const rawIssues = report?.snapshot.prioritizedIssues
  const issues = useMemo(() => rawIssues ?? [], [rawIssues])
  const snapshot: AnalysisSnapshot | null = report?.snapshot ?? null

  const filteredIssues = useMemo(() => {
    if (!filterQuery.trim()) return issues
    const q = filterQuery.toLowerCase()
    return issues.filter(i =>
      i.finding.title.toLowerCase().includes(q) ||
      i.finding.file.toLowerCase().includes(q)
    )
  }, [issues, filterQuery])

  // Derive active selected issue safely without setState inside effect
  const urlIssueId = searchParams.get('issueId')
  const effectiveSelectedId = selectedIssueId ?? urlIssueId ?? (issues.length > 0 ? issues[0].id : null)
  const selectedIssue = useMemo(
    () => issues.find(i => i.id === effectiveSelectedId) ?? (issues.length > 0 ? issues[0] : null),
    [issues, effectiveSelectedId]
  )

  const existingRepair = useMemo(
    () => (report?.repairs ?? []).find(r => r.issueId === selectedIssue?.id) ?? null,
    [report?.repairs, selectedIssue?.id]
  )

  const isLoading = status === 'loading' || status === 'analyzing'

  return (
    <AppLayout
      report={report}
      isAnalyzing={status === 'analyzing'}
      onAnalyze={() => analyze()}
    >
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page header */}
        <div className="pb-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
              Target Project · {project.displayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
            Guided Repair &amp; Remediation
          </h1>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
            Plan, execute, independently review, and locally verify code fixes
          </p>
        </div>

        {/* Idle / unanalyzed state */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 max-w-md mx-auto">
            <Wrench size={36} className="text-blue-400" />
            <div>
              <p className="text-lg font-bold text-white mb-1">No Analysis Completed</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Run an analysis on <strong className="text-white">{project.displayName}</strong> to select issues for repair.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => analyze()} className="gap-2 cursor-pointer">
              <RefreshCw size={14} />
              Analyze Project Now
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading repair workbench…</span>
          </div>
        )}

        {/* Ready with zero issues */}
        {status === 'ready' && report && snapshot && issues.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center rounded-xl border border-emerald-800/40 bg-emerald-950/15 p-8 max-w-lg mx-auto">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <div>
              <p className="text-base font-bold text-white mb-1">No Repairs Required</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                <strong className="text-white">{project.displayName}</strong> has no detected defects or failing assertions. The guided repair workflow is not needed.
              </p>
            </div>
          </div>
        )}

        {status === 'ready' && report && snapshot && issues.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Left: Issue Selector — Full-height working panel matching repair workflow */}
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col h-[calc(100vh-140px)] min-h-[600px] lg:sticky lg:top-20 overflow-hidden shadow-sm">
              {/* Header with Title, Count Badge, and Search Filter */}
              <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-blue-400" />
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      Select Finding to Repair
                    </h2>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
                    {issues.length}
                  </Badge>
                </div>

                {/* Filter search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder="Filter findings by title or file…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.7)] text-xs text-white placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Scrollable Findings List filling remaining vertical space */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[hsl(var(--border)/0.6)] scrollbar-thin">
                {filteredIssues.map(issue => {
                  const f = issue.finding
                  const isSelected = selectedIssue?.id === issue.id
                  return (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
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

              {/* Footer status bar */}
              <div className="px-4 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.15)] text-[11px] text-[hsl(var(--muted-foreground))] flex items-center justify-between font-mono shrink-0">
                <span>{filteredIssues.length} of {issues.length} shown</span>
                <span className="truncate max-w-[160px]">{project.typeLabel}</span>
              </div>
            </div>

            {/* Right: Repair Workflow Pipeline */}
            <div className="min-w-0 space-y-5">
              {!selectedIssue ? (
                <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] min-h-[350px]">
                  <Wrench size={32} className="text-[hsl(var(--muted-foreground))] mb-2" />
                  <p className="text-base font-bold text-white mb-1">Select an Issue to Repair</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm">
                    Choose any prioritized issue from the list to launch the guided 4-stage remediation pipeline.
                  </p>
                </div>
              ) : (
                <RepairWorkflow
                  key={selectedIssue.id}
                  issue={selectedIssue}
                  beforeSnapshot={snapshot}
                  projectPath={project.path}
                  existingRepair={existingRepair}
                  reportDelta={report?.delta}
                  reportAfterSnapshot={report?.afterSnapshot}
                  onWorkflowUpdated={async () => {
                    await reload()
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
