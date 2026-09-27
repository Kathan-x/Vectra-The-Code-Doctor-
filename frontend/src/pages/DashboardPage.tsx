import { useNavigate } from 'react-router-dom'
import { useDashboard } from '@/hooks/useDashboard'
import { useActiveProject } from '@/lib/activeProject'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProjectHealth } from '@/components/dashboard/ProjectHealth'
import { SeverityBreakdown } from '@/components/dashboard/SeverityBreakdown'
import { FindingsOverview } from '@/components/dashboard/FindingsOverview'
import { TestHealth } from '@/components/dashboard/TestHealth'
import { ProjectMetadata } from '@/components/dashboard/ProjectMetadata'
import { ErrorState, LoadingSkeleton } from '@/components/dashboard/AnalysisControls'
import { RefreshCw, Play, Sparkles, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { project } = useActiveProject()
  const { state, analyze } = useDashboard(project.path)
  const { status, report, error } = state

  const isAnalyzing = status === 'analyzing'
  const isLoading   = status === 'loading'

  const highOrCritical = (report?.summary.severity.critical || 0) + (report?.summary.severity.high || 0)

  return (
    <AppLayout
      report={report}
      isAnalyzing={isAnalyzing}
      onAnalyze={() => analyze()}
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">

        {/* Loading state */}
        {isLoading && <LoadingSkeleton />}

        {/* Error state */}
        {status === 'error' && error && (
          <ErrorState message={error} onRetry={() => analyze(true)} />
        )}

        {/* Idle / unanalyzed state */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[55vh] text-center gap-5 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-md">
              <Play size={26} className="text-blue-500 fill-blue-500/20 translate-x-0.5" />
            </div>
            <div className="space-y-2 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-800/40 text-[11px] font-semibold text-blue-300">
                <Sparkles size={12} />
                Ready for Telemetry
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Analyze Target Project
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Execute AST inspection, security rule analysis, and test suites against <strong className="text-white">Target Project · {project.displayName}</strong>.
              </p>
              <p className="text-xs font-mono text-blue-400">
                {project.typeLabel}
              </p>
            </div>
            <Button
              variant="default"
              size="md"
              onClick={() => analyze()}
              className="gap-2 px-6 shadow-sm cursor-pointer"
            >
              <RefreshCw size={15} />
              Run Full Analysis
            </Button>
          </div>
        )}

        {/* Dashboard ready */}
        {status === 'ready' && report && (
          <div className="space-y-7">

            {/* Page Header — What Project & Next Step in 5 Seconds */}
            <div className="flex items-start justify-between gap-4 flex-wrap pb-2 border-b border-[hsl(var(--border))]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    project.isImported
                      ? 'border-purple-800/60 bg-purple-950/40 text-purple-300'
                      : 'border-blue-800/60 bg-blue-950/40 text-blue-300'
                  }`}>
                    {project.isImported ? 'Imported Project' : 'Demo Target'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
                  Target Project · {project.displayName}
                </h1>
                <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
                  {project.typeLabel}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyze(true)}
                  disabled={isAnalyzing}
                  className="gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
                  <span>{isAnalyzing ? 'Analyzing…' : 'Re-analyze'}</span>
                </Button>
              </div>
            </div>

            {/* Contextual Next Step Banner */}
            {report.summary.totalFindings > 0 ? (
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-800/40 bg-amber-950/20 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      Recommended Next Step: Review {highOrCritical > 0 ? `${highOrCritical} High / Critical Issues` : `${report.summary.totalFindings} Issues`}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Explore the prioritized finding list, trace AST impact, and launch guided remediation.
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/issues')}
                  className="gap-1.5 shrink-0 font-medium cursor-pointer"
                >
                  <span>Review Issues</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Target Project Clean: Zero Active Issues</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      All diagnostic rules passed. You can view or generate the final engineering proof.
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/report')}
                  className="gap-1.5 shrink-0 font-medium cursor-pointer"
                >
                  <span>View Report</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            )}

            {/* Health Hero & Primary Metrics (Total, High/Critical, Failed Tests, Pass Rate) */}
            <ProjectHealth report={report} />

            {/* Severity Breakdown + Test Health Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SeverityBreakdown
                severity={report.summary.severity}
                total={report.summary.totalFindings}
              />
              <TestHealth testResults={report.snapshot.testResults} />
            </div>

            {/* Priority Findings Subset */}
            <FindingsOverview
              issues={report.snapshot.prioritizedIssues}
              maxShown={5}
            />

            {/* Compact Project Metadata at Bottom */}
            <ProjectMetadata
              projectInfo={report.snapshot.projectInfo}
              analysisTimestamp={report.snapshot.timestamp}
              reportTimestamp={report.createdAt}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
