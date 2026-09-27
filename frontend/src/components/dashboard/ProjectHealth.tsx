import type { ProjectReport } from '@/types'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, ShieldAlert, FlaskConical, Target, Award } from 'lucide-react'

interface ProjectHealthProps {
  report: ProjectReport
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  NOT_ANALYZED:           { label: 'Not Analyzed',           color: 'text-[hsl(var(--muted-foreground))]', bg: 'bg-[hsl(var(--muted))] border-[hsl(var(--border))]', icon: <Info size={13} /> },
  ISSUES_FOUND:           { label: 'Issues Found',           color: 'text-amber-400',                      bg: 'bg-amber-950/40 border border-amber-800/40',          icon: <AlertCircle size={13} /> },
  REPAIR_IN_PROGRESS:     { label: 'Repair In Progress',     color: 'text-blue-400',                       bg: 'bg-blue-950/40 border border-blue-800/40',            icon: <FlaskConical size={13} /> },
  READY_FOR_VERIFICATION: { label: 'Ready for Verification', color: 'text-yellow-400',                     bg: 'bg-yellow-950/40 border border-yellow-800/40',        icon: <FlaskConical size={13} /> },
  VERIFIED:               { label: 'Verified',               color: 'text-emerald-400',                    bg: 'bg-emerald-950/40 border border-emerald-800/40',      icon: <CheckCircle2 size={13} /> },
  VERIFICATION_FAILED:    { label: 'Verification Failed',    color: 'text-red-400',                        bg: 'bg-red-950/40 border border-red-800/40',              icon: <AlertTriangle size={13} /> },
}

export function ProjectHealth({ report }: ProjectHealthProps) {
  const { summary, status } = report
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_ANALYZED

  const highOrCritical = (summary.severity.critical || 0) + (summary.severity.high || 0)
  const passRate = summary.totalTests > 0
    ? Math.round((summary.passingTests / summary.totalTests) * 100)
    : 100

  return (
    <div className="space-y-4">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        <div>
          <h2 className="text-lg sm:text-[19px] font-bold text-white tracking-tight">
            Engineering Health
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Deterministic diagnostic telemetry and test verification
          </p>
        </div>

        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shrink-0 shadow-xs border', cfg.bg, cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Primary Metrics Grid — 4 Prominent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Findings */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 hover:border-[hsl(var(--border))]/80 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))] mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Total Findings</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight tabular-nums">
              {summary.totalFindings}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              in {summary.affectedFiles} {summary.affectedFiles === 1 ? 'file' : 'files'}
            </span>
          </div>
        </div>

        {/* Metric 2: High / Critical */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 hover:border-[hsl(var(--border))]/80 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))] mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">High / Critical</span>
            <ShieldAlert size={16} className={highOrCritical > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold tracking-tight tabular-nums', highOrCritical > 0 ? 'text-amber-400' : 'text-emerald-400')}>
              {highOrCritical}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {highOrCritical > 0 ? 'immediate priority' : 'zero high risk'}
            </span>
          </div>
        </div>

        {/* Metric 3: Failed Tests */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 hover:border-[hsl(var(--border))]/80 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))] mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Failed Tests</span>
            <AlertTriangle size={16} className={summary.failingTests > 0 ? 'text-red-400' : 'text-emerald-400'} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold tracking-tight tabular-nums', summary.failingTests > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {summary.failingTests}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              of {summary.totalTests} total
            </span>
          </div>
        </div>

        {/* Metric 4: Pass Rate */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4.5 hover:border-[hsl(var(--border))]/80 transition-colors shadow-xs">
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))] mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Pass Rate</span>
            <Award size={16} className={passRate === 100 ? 'text-emerald-400' : 'text-blue-400'} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold tracking-tight tabular-nums', passRate === 100 ? 'text-emerald-400' : passRate >= 80 ? 'text-white' : 'text-amber-400')}>
              {passRate}%
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {summary.passingTests} passed
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
