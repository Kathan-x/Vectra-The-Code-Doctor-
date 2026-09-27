/**
 * ReportPage — /report
 * The final proof of the engineering workflow.
 *
 * Ordered sections:
 * 1. Overall Status
 * 2. Executive Summary
 * 3. Before → After
 * 4. Verification
 * 5. Priority Findings
 * 6. Repair History
 * 7. Affected Files / Categories
 * 8. Timestamps
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useActiveProject } from '@/lib/activeProject'
import { logActivity } from '@/lib/activityStore'
import type { ProjectReport, Severity } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  FileCode, FlaskConical, Loader2, ChevronRight,
  Info, AlertCircle, Download, FileText,
} from 'lucide-react'
import { severityColor, categoryLabel } from '@/lib/tokens'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  NOT_ANALYZED:           { label: 'Not Analyzed',           icon: <Info size={13} />,         color: 'text-[hsl(var(--muted-foreground))]', bg: 'bg-[hsl(var(--muted))] border-[hsl(var(--border))]' },
  ISSUES_FOUND:           { label: 'Issues Found',           icon: <AlertCircle size={13} />,   color: 'text-amber-400',                      bg: 'bg-amber-950/40 border border-amber-800/40' },
  REPAIR_IN_PROGRESS:     { label: 'Repair In Progress',     icon: <Loader2 size={13} />,       color: 'text-blue-400',                       bg: 'bg-blue-950/40 border border-blue-800/40' },
  READY_FOR_VERIFICATION: { label: 'Ready for Verification', icon: <FlaskConical size={13} />,  color: 'text-yellow-400',                     bg: 'bg-yellow-950/40 border border-yellow-800/40' },
  VERIFIED:               { label: 'Verified',               icon: <CheckCircle2 size={13} />,  color: 'text-emerald-400',                    bg: 'bg-emerald-950/40 border border-emerald-800/40' },
  VERIFICATION_FAILED:    { label: 'Verification Failed',    icon: <XCircle size={13} />,       color: 'text-red-400',                        bg: 'bg-red-950/40 border border-red-800/40' },
}

function formatTs(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'generating'

export default function ReportPage() {
  const navigate = useNavigate()
  const { project } = useActiveProject()

  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [report, setReport] = useState<ProjectReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const loadReport = useCallback(async () => {
    setPageStatus('loading')
    setError(null)
    try {
      const r = await api.getReport(project.path)
      setReport(r)
      setPageStatus('ready')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('No report') || msg.includes('404')) {
        setPageStatus('not-found')
      } else {
        setError(msg)
        setPageStatus('error')
      }
    }
  }, [project.path])

  const generateReport = useCallback(async () => {
    if (report) {
      setIsRegenerating(true)
      try {
        const r = await api.generateReport(project.path)
        setReport(r)
        logActivity({
          type: 'report_generated',
          title: `Report Refreshed: ${project.displayName}`,
          description: `Telemetry updated. Total findings: ${r.summary.totalFindings}, tests: ${r.summary.totalTests}.`,
          projectName: project.displayName,
        })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsRegenerating(false)
      }
      return
    }
    setPageStatus('generating')
    setError(null)
    try {
      const r = await api.generateReport(project.path)
      setReport(r)
      setPageStatus('ready')
      logActivity({
        type: 'report_generated',
        title: `Report Generated: ${project.displayName}`,
        description: `Engineering proof compiled for ${project.displayName}.`,
        projectName: project.displayName,
      })
    } catch (err) {
      setError((err as Error).message)
      setPageStatus('error')
    }
  }, [report, project.path, project.displayName])

  useEffect(() => {
    let active = true
    api.getReport(project.path)
      .then(r => {
        if (active) {
          setReport(r)
          setPageStatus('ready')
        }
      })
      .catch(err => {
        if (!active) return
        const msg = (err as Error).message
        if (msg.includes('No report') || msg.includes('404')) {
          setPageStatus('not-found')
        } else {
          setError(msg)
          setPageStatus('error')
        }
      })
    return () => { active = false }
  }, [project.path])

  const handleExportJson = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vectra-report-${project.displayName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (pageStatus === 'loading' || pageStatus === 'generating') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[hsl(var(--muted-foreground))]">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-sm font-medium">Generating engineering diagnostic report…</p>
        </div>
      </AppLayout>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────
  if (pageStatus === 'not-found') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-4 max-w-md text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8">
            <FileText size={36} className="text-blue-400" />
            <div>
              <p className="text-base font-bold text-white mb-1">No Report Generated Yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Run analysis on <strong className="text-white">{project.displayName}</strong> to compile the engineering report.
              </p>
            </div>
            <div className="flex gap-3 mt-1">
              <Button variant="default" size="sm" onClick={generateReport} className="gap-2 cursor-pointer">
                <RefreshCw size={14} />
                Generate Report Now
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (pageStatus === 'error' || !report) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-4 max-w-md text-center rounded-xl border border-red-800/40 bg-red-950/20 p-8">
            <AlertTriangle size={32} className="text-red-400" />
            <div>
              <p className="text-base font-bold text-white mb-1">Failed to Load Report</p>
              <p className="text-xs text-red-200 leading-relaxed">{error}</p>
            </div>
            <Button variant="default" size="sm" onClick={loadReport} className="gap-2 mt-1 cursor-pointer">
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const { summary, status: reportStatus, repairs = [], delta } = report
  const statusCfg = STATUS_CONFIG[reportStatus] ?? STATUS_CONFIG.NOT_ANALYZED
  const verifiedDelta = report.afterSnapshot ? delta : null

  const customStatusLabel = reportStatus === 'VERIFICATION_FAILED'
    ? (summary.failingTests > 0
        ? 'Verification Failed — Failing Tests Remain'
        : summary.verificationReason === 'review_concern'
        ? 'Verification Failed — Review Flagged Concerns'
        : summary.verificationReason === 'issue_persists' || summary.failingTests === 0
        ? 'Verification Failed — Issue Persists'
        : 'Verification Failed')
    : statusCfg.label

  return (
    <AppLayout report={report}>
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">

        {/* Document Header & Actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-[hsl(var(--border))]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                Target Project · {project.displayName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
              Engineering Diagnostic &amp; Proof Report
            </h1>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
              Deterministic AST findings, call-graph impact telemetry, and test verification proof
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="gap-1.5 font-medium text-xs cursor-pointer"
            >
              <Download size={13} />
              <span>Export JSON</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={generateReport}
              disabled={isRegenerating}
              className="gap-1.5 font-medium text-xs shadow-xs cursor-pointer"
            >
              <RefreshCw size={13} className={isRegenerating ? 'animate-spin' : ''} />
              <span>{isRegenerating ? 'Refreshing…' : 'Refresh Report'}</span>
            </Button>
          </div>
        </div>

        {/* 1. OVERALL STATUS */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            1. Overall Status
          </span>

          <div className="flex items-center justify-between p-4.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex-wrap gap-4 shadow-xs">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Current Lifecycle State
              </p>
              <p className="text-xl font-bold text-white">
                {customStatusLabel}
              </p>
            </div>

            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border shadow-xs', statusCfg.bg, statusCfg.color)}>
              {statusCfg.icon}
              {customStatusLabel}
            </span>
          </div>
        </div>

        {/* 2. EXECUTIVE SUMMARY */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            2. Executive Summary
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-0.5">Total Findings</p>
              <p className="text-2xl font-bold text-white tabular-nums">{summary.totalFindings}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">in {summary.affectedFiles} source files</p>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-0.5">Failing Tests</p>
              <p className={cn('text-2xl font-bold tabular-nums', summary.failingTests > 0 ? 'text-red-400' : 'text-emerald-400')}>
                {summary.totalTests > 0 ? summary.failingTests : '—'}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {summary.totalTests > 0 ? `of ${summary.totalTests} total tests` : 'no test suite run'}
              </p>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-0.5">Passing Tests</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                {summary.totalTests > 0 ? summary.passingTests : '—'}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {summary.totalTests > 0 ? `${Math.round((summary.passingTests / summary.totalTests) * 100)}% pass rate` : 'No test results available'}
              </p>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-0.5">Repaired Issues</p>
              <p className="text-2xl font-bold text-blue-400 tabular-nums">{summary.repairedIssues}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">automated repair plans</p>
            </div>
          </div>
        </div>

        {/* 3. BEFORE → AFTER DELTA PROOF */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            3. Before → After Delta Proof
          </span>

          {delta ? (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4 shadow-xs">
              {verifiedDelta ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      Baseline Metrics (Before)
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Total Findings</span>
                        <span className="font-bold text-white tabular-nums">{verifiedDelta.findingsBefore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Failing Tests</span>
                        <span className="font-bold text-red-400 tabular-nums">{verifiedDelta.testFailingBefore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Passing Tests</span>
                        <span className="font-bold text-emerald-400 tabular-nums">{verifiedDelta.testPassingBefore}</span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      Post-Repair Metrics (After)
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Total Findings</span>
                        <span className="font-bold text-white tabular-nums">{verifiedDelta.findingsAfter ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Failing Tests</span>
                        <span className="font-bold text-emerald-400 tabular-nums">{verifiedDelta.testFailingAfter ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Passing Tests</span>
                        <span className="font-bold text-emerald-400 tabular-nums">{verifiedDelta.testPassingAfter ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Status Delta Breakdown */}
              {verifiedDelta ? (
                <div className="pt-2 border-t border-[hsl(var(--border)/0.6)] space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Status Delta Breakdown
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
                      <CheckCircle2 size={12} />
                      {verifiedDelta.resolvedFindingIds.length} Findings Resolved
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-white">
                      {verifiedDelta.remainingFindingIds.length} Remaining
                    </span>
                    {verifiedDelta.newFindingIds && verifiedDelta.newFindingIds.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-800/60 bg-red-950/40 text-red-300">
                        <XCircle size={12} />
                        {verifiedDelta.newFindingIds.length} Introduced
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-center space-y-1 shadow-xs">
              <p className="text-sm font-semibold text-white">No Verification Completed Yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
                A verified delta proof requires completing an automated repair pass in Guided Repair. Once repairs are applied and verified, the delta will appear here.
              </p>
            </div>
          )}
        </div>

        {/* 4. VERIFICATION */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            4. Test Verification Telemetry
          </span>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-[hsl(var(--border))] flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">Test Suites Execution Result</h3>
              </div>
              <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                {summary.totalTests} total · {summary.passingTests} passed · {summary.failingTests} failed
              </span>
            </div>

            {/* Execution Telemetry Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-2.5 space-y-0.5">
                <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Command</span>
                <p className="font-mono text-white truncate text-xs" title={report.snapshot.testResults.commandUsed ?? 'none'}>
                  {report.snapshot.testResults.commandUsed ?? 'none'}
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-2.5 space-y-0.5">
                <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Working Directory</span>
                <p className="font-mono text-white truncate text-xs" title={report.snapshot.testResults.workingDirectory ?? report.projectPath}>
                  {report.snapshot.testResults.workingDirectory ? report.snapshot.testResults.workingDirectory.split(/[/\\]/).slice(-2).join('/') : 'project root'}
                </p>
              </div>
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-2.5 space-y-0.5">
                <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase">Status</span>
                <p className="font-semibold text-white capitalize text-xs">
                  {report.snapshot.testResults.executionStatus === 'unable_to_execute' ? 'Unable to Execute' :
                   report.snapshot.testResults.executionStatus === 'no_tests_found' ? 'No Tests Found' :
                   report.snapshot.testResults.executionStatus ?? 'Not Run'}
                </p>
              </div>
            </div>

            {report.snapshot.testResults.executionStatus === 'unable_to_execute' && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300">
                <p className="font-semibold">Tests detected but unable to execute</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Test files were found in this project, but no supported test command could be executed.
                </p>
              </div>
            )}

            {report.snapshot.testResults.tests.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] py-3 text-center">
                {report.snapshot.testResults.statusMessage ?? 'No test records detected in active project.'}
              </p>
            ) : (
              <div className="divide-y divide-[hsl(var(--border)/0.6)] max-h-72 overflow-y-auto pr-1">
                {report.snapshot.testResults.tests.map((t, idx) => {
                  const isPassed = t.status === 'passed'
                  return (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2 min-w-0">
                        {isPassed ? (
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-white break-words">{t.name}</p>
                          {t.errorMessage && (
                            <pre className="text-[11px] font-mono text-red-300 bg-red-950/20 p-2 rounded border border-red-900/30 whitespace-pre-wrap mt-1">
                              {t.errorMessage.split('\n')[0]}
                            </pre>
                          )}
                        </div>
                      </div>
                      <span className={cn(
                        'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 border',
                        isPassed ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400' : 'border-red-800/60 bg-red-950/40 text-red-400'
                      )}>
                        {t.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5. PRIORITY FINDINGS */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              5. Priority Findings
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/issues')}
              className="gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              <span>Explore all {report.snapshot.prioritizedIssues.length} issues</span>
              <ChevronRight size={13} />
            </Button>
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-xs divide-y divide-[hsl(var(--border)/0.6)]">
            {report.snapshot.prioritizedIssues.slice(0, 5).map((issue, idx) => {
              const f = issue.finding
              return (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-[hsl(var(--muted)/0.3)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-5 text-center">
                      #{idx + 1}
                    </span>
                    <Badge variant={f.severity} className="uppercase text-[10px] font-bold px-2 py-0.5 shrink-0">
                      {f.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                        {f.title}
                      </p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono mt-0.5 flex items-center gap-1.5 truncate">
                        <FileCode size={11} className="shrink-0" />
                        <span>{f.file}{f.line ? `:${f.line}` : ''}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={cn('text-xs font-semibold uppercase', severityColor[f.severity])}>
                      {categoryLabel[f.category] ?? f.category}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-white bg-[hsl(var(--muted)/0.6)] px-2 py-0.5 rounded border border-[hsl(var(--border))]">
                      score {issue.score}
                    </span>
                    <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))] group-hover:text-white" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 6. REPAIR HISTORY */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            6. Repair History
          </span>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-3 shadow-xs">
            {repairs.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] py-3 text-center">
                No automated repairs have been executed on this project yet.
              </p>
            ) : (
              <div className="divide-y divide-[hsl(var(--border)/0.6)]">
                {repairs.map((r, i) => (
                  <div key={i} className="py-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">{r.issueId}</span>
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{formatTs(r.appliedAt)}</span>
                    </div>
                    {r.plan && (
                      <p className="text-xs text-[hsl(var(--foreground))]">{r.plan.summary}</p>
                    )}
                    {r.reviewResult && (
                      <span className={cn(
                        'inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                        r.reviewResult.status === 'approved' ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300' :
                        r.reviewResult.status === 'concerns' ? 'border-amber-800/60 bg-amber-950/40 text-amber-300' :
                        'border-red-800/60 bg-red-950/40 text-red-300'
                      )}>
                        Review: {r.reviewResult.status === 'approved' ? 'Approved' : r.reviewResult.status === 'concerns' ? 'Concerns noted' : 'Blocked'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 7. AFFECTED FILES & CATEGORY DISTRIBUTION */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            7. Affected Files &amp; Category Distribution
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categories */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 space-y-2.5 shadow-xs">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Findings by Category</h3>
              <div className="space-y-2 text-xs">
                {Object.entries(summary.categories).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-[hsl(var(--foreground))] capitalize">{categoryLabel[cat] ?? cat}</span>
                    <span className="font-bold text-white tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 space-y-2.5 shadow-xs">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Severity Distribution</h3>
              <div className="space-y-2 text-xs">
                {Object.entries(summary.severity).map(([sev, count]) => (
                  <div key={sev} className="flex items-center justify-between">
                    <span className={cn('capitalize font-medium', severityColor[sev as Severity])}>{sev}</span>
                    <span className="font-bold text-white tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 8. TIMESTAMPS & AUDIT METADATA */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            8. Audit Telemetry &amp; Timestamps
          </span>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 text-xs text-[hsl(var(--muted-foreground))] space-y-2 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 py-1 border-b border-[hsl(var(--border)/0.6)]">
              <span>Report Identifier</span>
              <span className="font-mono text-white">{report.id}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-1 border-b border-[hsl(var(--border)/0.6)]">
              <span>Target Project Root</span>
              <span className="font-mono text-white truncate max-w-md">{report.projectPath}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-1 border-b border-[hsl(var(--border)/0.6)]">
              <span>Analysis Snapshot Timestamp</span>
              <span className="text-white">{formatTs(report.snapshot.timestamp)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 py-1">
              <span>Report Generated Timestamp</span>
              <span className="text-white">{formatTs(report.createdAt)}</span>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
