/**
 * VerifyPage — /verify
 * Verifies whether repairs resolved issues without regressions using real test suites and AST checks.
 *
 * Shows: Tests | Passed | Failed | Pass Rate | Verification Status | Before → After
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { useDashboard } from '@/hooks/useDashboard'
import { useActiveProject } from '@/lib/activeProject'
import { logActivity } from '@/lib/activityStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  XCircle, Loader2, FlaskConical, ArrowRight,
  CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function VerifyPage() {
  const navigate = useNavigate()
  const { project } = useActiveProject()
  const { state, analyze, reload } = useDashboard(project.path)
  const { status, report } = state
  const [isVerifyingNow, setIsVerifyingNow] = useState(false)

  const isLoading = status === 'loading' || status === 'analyzing' || isVerifyingNow

  const handleRunVerify = async () => {
    if (isVerifyingNow) return
    setIsVerifyingNow(true)
    try {
      const verifiedReport = await api.verify(project.path)
      await reload()

      logActivity({
        type: 'verification_completed',
        title: `Verification Executed: ${project.displayName}`,
        description: `Evaluated ${verifiedReport.snapshot.testResults.total} tests (${verifiedReport.summary.passingTests} passed, ${verifiedReport.summary.failingTests} failed).`,
        projectName: project.displayName,
      })
    } catch (err) {
      console.error('Verification failed:', err)
    } finally {
      setIsVerifyingNow(false)
    }
  }

  return (
    <AppLayout
      report={report}
      isAnalyzing={status === 'analyzing' || isVerifyingNow}
      onAnalyze={() => analyze()}
    >
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-[hsl(var(--border))]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                Target Project · {project.displayName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
              Test Verification &amp; Delta Proof
            </h1>
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
              Validate that repairs eliminated defects without breaking existing test suites
            </p>
          </div>

          {report && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRunVerify}
              disabled={isLoading}
              className="gap-1.5 font-semibold shadow-xs cursor-pointer text-xs"
            >
              <FlaskConical size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Running Verification…' : 'Run Full Verification'}</span>
            </Button>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium">Executing local test runner and computing delta…</span>
          </div>
        )}

        {/* Idle / unanalyzed state */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 max-w-md mx-auto">
            <FlaskConical size={36} className="text-blue-400" />
            <div>
              <p className="text-lg font-bold text-white mb-1">No Analysis Completed</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Run an initial analysis of <strong className="text-white">{project.displayName}</strong> to capture test baseline.
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => analyze()} className="gap-2 cursor-pointer">
              <RefreshCw size={14} />
              Analyze Project Now
            </Button>
          </div>
        )}

        {/* Ready with Report */}
        {status === 'ready' && report && !isLoading && (
          <div className="space-y-6">
            {/* Primary Verification Status Banner */}
            {(() => {
              const v = report.summary.verificationStatus
              const reason = report.summary.verificationReason
              const failingTests = report.summary.failingTests
              const passingTests = report.summary.passingTests
              const totalTests = report.summary.totalTests

              const isVerified = v === 'passed'
              const isFailed   = v === 'failed'
              const isPartial  = v === 'partial'
              const notRun     = v === 'not_run'

              let bannerTitle = 'No Verification Has Been Completed Yet'
              let bannerDesc = 'Verification runs real test suites to mathematically prove fixes. Open an issue and launch the repair workflow to verify.'

              if (isVerified) {
                bannerTitle = 'Verification Passed — All Repairs Proven'
                bannerDesc = 'All automated tests pass cleanly and targeted defects were confirmed resolved in the AST.'
              } else if (isFailed) {
                if (failingTests > 0) {
                  bannerTitle = 'Verification Failed — Failing Tests Remain'
                  bannerDesc = `The test suite reported ${failingTests} failing assertion${failingTests === 1 ? '' : 's'} after code modification. Review the failed assertions below.`
                } else if (reason === 'issue_persists' || failingTests === 0) {
                  bannerTitle = 'Verification Failed — Issue Persists'
                  bannerDesc = totalTests > 0
                    ? `All ${passingTests}/${totalTests} tests passed cleanly, but post-repair analysis confirms targeted defect(s) still remain in the codebase.`
                    : 'Targeted defect still persists in the codebase after repair execution.'
                } else if (reason === 'review_concern') {
                  bannerTitle = 'Verification Failed — Independent Review Flagged Concerns'
                  bannerDesc = 'Tests passed, but the independent second-pass review flagged security or regression risks in the applied diff.'
                } else if (reason === 'analysis_failed') {
                  bannerTitle = 'Verification Failed — Re-analysis Error'
                  bannerDesc = 'Re-analysis could not be completed cleanly following repair execution.'
                } else {
                  bannerTitle = 'Verification Failed — Issue Persists'
                  bannerDesc = 'The repair was applied, but the targeted defect remains in the project.'
                }
              } else if (isPartial) {
                if (reason === 'review_concern') {
                  bannerTitle = 'Verification Partial — Review Flagged Concerns'
                  bannerDesc = 'Defects were resolved and tests improved, but the independent review identified concerns requiring attention.'
                } else {
                  bannerTitle = 'Partial Verification — Some Tests Improved'
                  bannerDesc = 'Test pass rate improved, but some edge case assertions or defects are still failing.'
                }
              }

              return (
                <div className={cn(
                  'rounded-xl border p-5 sm:p-6 shadow-xs transition-all',
                  isVerified ? 'border-emerald-800/60 bg-emerald-950/20' :
                  isFailed   ? 'border-red-800/60 bg-red-950/20'         :
                  isPartial  ? 'border-amber-800/60 bg-amber-950/20'     :
                  'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                )}>
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                    <div className="flex items-start gap-3">
                      {isVerified ? (
                        <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" />
                      ) : isFailed ? (
                        <XCircle size={24} className="text-red-400 shrink-0 mt-0.5" />
                      ) : isPartial ? (
                        <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <FlaskConical size={24} className="text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          {bannerTitle}
                        </h2>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed max-w-xl">
                          {bannerDesc}
                        </p>
                      </div>
                    </div>

                    {notRun && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate('/issues')}
                        className="gap-1.5 font-medium text-xs cursor-pointer"
                      >
                        <span>Open an Issue</span>
                        <ArrowRight size={13} />
                      </Button>
                    )}
                  </div>

                  {/* Test Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Total Tests',
                        value: report.summary.totalTests > 0 ? report.summary.totalTests : '0',
                        subtitle: report.summary.totalTests > 0 ? 'suite total' : 'no tests detected',
                        color: 'text-white'
                      },
                      {
                        label: 'Passing',
                        value: report.summary.totalTests > 0 ? report.summary.passingTests : '—',
                        subtitle: report.summary.totalTests > 0 ? 'passing clean' : 'not executed',
                        color: 'text-emerald-400'
                      },
                      {
                        label: 'Failing',
                        value: report.summary.totalTests > 0 ? report.summary.failingTests : '—',
                        subtitle: report.summary.failingTests > 0 ? 'failing assertions' : report.summary.totalTests > 0 ? 'zero failures' : 'not executed',
                        color: report.summary.failingTests > 0 ? 'text-red-400' : 'text-emerald-400'
                      },
                      {
                        label: 'Pass Rate',
                        value: report.summary.totalTests > 0
                          ? `${Math.round((report.summary.passingTests / report.summary.totalTests) * 100)}%`
                          : 'N/A',
                        subtitle: report.summary.totalTests > 0 ? `${report.summary.passingTests}/${report.summary.totalTests} passing` : 'No test results available',
                        color: 'text-white',
                      },
                    ].map(({ label, value, subtitle, color }) => (
                      <div key={label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 text-center">
                        <p className={cn('text-2xl font-bold tabular-nums tracking-tight', color)}>{value}</p>
                        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mt-0.5">{label}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{subtitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Test Verification Telemetry Panel */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-blue-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Test Verification Telemetry</h2>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-1">
                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Command Used</span>
                    <p className="font-mono text-white truncate text-xs font-medium" title={report.snapshot.testResults.commandUsed ?? 'none'}>
                      {report.snapshot.testResults.commandUsed ?? 'none'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-1">
                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Working Directory</span>
                    <p className="font-mono text-white truncate text-xs font-medium" title={report.snapshot.testResults.workingDirectory ?? report.projectPath}>
                      {report.snapshot.testResults.workingDirectory ? report.snapshot.testResults.workingDirectory.split(/[/\\]/).slice(-2).join('/') : 'project root'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 space-y-1">
                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Execution Status</span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className={cn(
                        'h-2 w-2 rounded-full',
                        report.snapshot.testResults.executionStatus === 'passed' ? 'bg-emerald-400' :
                        report.snapshot.testResults.executionStatus === 'failed' ? 'bg-red-400' :
                        report.snapshot.testResults.executionStatus === 'unable_to_execute' ? 'bg-amber-400' : 'bg-zinc-400'
                      )} />
                      <span className="font-semibold text-white capitalize text-xs">
                        {report.snapshot.testResults.executionStatus === 'unable_to_execute' ? 'Unable to Execute' :
                         report.snapshot.testResults.executionStatus === 'no_tests_found' ? 'No Tests Detected' :
                         report.snapshot.testResults.executionStatus ?? 'Not Run'}
                      </span>
                    </div>
                  </div>
                </div>

                {report.snapshot.testResults.executionStatus === 'unable_to_execute' && (
                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold">Tests detected but unable to execute</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        Test files were discovered in the repository, but no supported test runner script or package configuration could be executed.
                      </p>
                    </div>
                  </div>
                )}

                {report.snapshot.testResults.tests.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[hsl(var(--border)/0.6)]">
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-semibold text-white">Execution Assertions ({report.snapshot.testResults.tests.length})</span>
                      <span className="font-mono text-[11px]">Duration: {report.snapshot.testResults.duration}ms</span>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--border)/0.8)] divide-y divide-[hsl(var(--border)/0.4)] max-h-64 overflow-y-auto bg-[hsl(var(--background)/0.5)]">
                      {report.snapshot.testResults.tests.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 text-xs gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {t.status === 'passed' ? (
                              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle size={13} className="text-red-400 shrink-0" />
                            )}
                            <span className="font-medium text-white truncate">{t.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {t.duration !== undefined && (
                              <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{t.duration}ms</span>
                            )}
                            <span className={cn(
                              'text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border',
                              t.status === 'passed' ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-400' : 'border-red-800/50 bg-red-950/40 text-red-400'
                            )}>
                              {t.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Before / After Delta Proof */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Before → After Delta Proof</h2>
              </div>

              {report.afterSnapshot && report.delta ? (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-5 shadow-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Card */}
                    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        Baseline (Before Repair)
                      </span>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-white tabular-nums">{report.delta.findingsBefore}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Findings</p>
                        </div>
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-emerald-400 tabular-nums">{report.delta.testPassingBefore}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Passing</p>
                        </div>
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-red-400 tabular-nums">{report.delta.testFailingBefore}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Failing</p>
                        </div>
                      </div>
                    </div>

                    {/* After Card */}
                    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Current Verified State (After Repair)
                      </span>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-white tabular-nums">{report.delta.findingsAfter ?? '—'}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Findings</p>
                        </div>
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-emerald-400 tabular-nums">{report.delta.testPassingAfter ?? '—'}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Passing</p>
                        </div>
                        <div className="bg-[hsl(var(--muted)/0.4)] p-2 rounded-lg">
                          <p className="text-lg font-bold text-red-400 tabular-nums">{report.delta.testFailingAfter ?? '—'}</p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Failing</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resolved findings breakdown */}
                  {report.delta.resolvedFindingIds.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-[hsl(var(--border)/0.6)]">
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Check size={14} />
                        {report.delta.resolvedFindingIds.length} Findings Eliminated
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {report.delta.resolvedFindingIds.map(id => (
                          <span key={id} className="text-[11px] font-mono bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Persisting findings breakdown */}
                  {report.delta.remainingFindingIds.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-[hsl(var(--border)/0.6)]">
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        {report.delta.remainingFindingIds.length} Persisting Finding{report.delta.remainingFindingIds.length === 1 ? '' : 's'} Remaining
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {report.delta.remainingFindingIds.map(id => (
                          <span key={id} className="text-[11px] font-mono bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Newly introduced regressions breakdown */}
                  {report.delta.newFindingIds.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-[hsl(var(--border)/0.6)]">
                      <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                        <XCircle size={14} />
                        {report.delta.newFindingIds.length} Newly Introduced Regression{report.delta.newFindingIds.length === 1 ? '' : 's'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {report.delta.newFindingIds.map(id => (
                          <span key={id} className="text-[11px] font-mono bg-red-950/40 text-red-300 border border-red-800/40 px-2 py-0.5 rounded">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center space-y-2">
                  <FlaskConical size={32} className="mx-auto text-[hsl(var(--muted-foreground))] opacity-50 mb-1" />
                  <p className="text-base font-bold text-white">No Verification Completed Yet</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-md mx-auto leading-relaxed">
                    A verified delta proof requires completing an automated repair pass in Guided Repair. Once repairs are applied and verified against the target codebase, the mathematically proven before/after delta will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
