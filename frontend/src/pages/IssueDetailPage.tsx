/**
 * IssueDetailPage — /issues/:issueId
 * Reorganized into 6 clear, progressive engineering sections:
 * 1. WHAT IS WRONG?
 * 2. EVIDENCE
 * 3. ROOT CAUSE
 * 4. IMPACT
 * 5. RELATED TESTS
 * 6. REPAIR
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useIssueDetail } from '@/hooks/useIssueDetail'
import { useActiveProject } from '@/lib/activeProject'
import { AppLayout } from '@/components/layout/AppLayout'
import { IssueHeader } from '@/components/issue/IssueHeader'
import { IssueEvidence } from '@/components/issue/IssueEvidence'
import { IssueRootCause } from '@/components/issue/IssueRootCause'
import { AffectedFiles } from '@/components/issue/AffectedFiles'
import { RelatedTests } from '@/components/issue/RelatedTests'
import { ImpactMapViz } from '@/components/impact/ImpactMap'
import { ImpactSummary } from '@/components/impact/ImpactSummary'
import { RepairWorkflow } from '@/components/repair/RepairWorkflow'
import { ArrowLeft, AlertTriangle, Loader2, SearchX, GitBranch, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>()
  const navigate = useNavigate()
  const { project } = useActiveProject()

  const {
    status,
    issue,
    snapshot,
    impactMap,
    impactStatus,
    error,
    impactError,
  } = useIssueDetail(issueId, project.path)

  // ── Loading ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[hsl(var(--muted-foreground))]">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-sm font-medium">Loading issue diagnostic data…</p>
        </div>
      </AppLayout>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────
  if (status === 'not-found') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-4 max-w-md text-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8">
            <SearchX size={32} className="text-[hsl(var(--muted-foreground))]" />
            <div>
              <p className="text-base font-bold text-white mb-1">Issue Not Found</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                {error ?? `Issue "${issueId}" was not found in the current project analysis.`}
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => navigate('/issues')} className="gap-2 cursor-pointer">
              <ArrowLeft size={14} /> Back to Issues Explorer
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (status === 'error' || !issue) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center px-6 py-16">
          <div className="flex flex-col items-center gap-4 max-w-md text-center rounded-2xl border border-red-800/40 bg-red-950/20 p-8">
            <AlertTriangle size={32} className="text-red-400" />
            <div>
              <p className="text-base font-bold text-white mb-1">Failed to Load Issue</p>
              <p className="text-xs text-red-200 leading-relaxed">
                {error ?? 'An unexpected error occurred while reading the analysis snapshot.'}
              </p>
            </div>
            <Button variant="default" size="sm" onClick={() => navigate('/issues')} className="gap-2 cursor-pointer">
              <ArrowLeft size={14} /> Back to Issues Explorer
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">

        {/* 1. WHAT IS WRONG? */}
        <IssueHeader issue={issue} />

        {/* 2. EVIDENCE */}
        <IssueEvidence finding={issue.finding} relatedTests={issue.relatedTests} />

        {/* 3. ROOT CAUSE */}
        <IssueRootCause finding={issue.finding} />

        {/* 4. IMPACT */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-xs">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] flex-wrap">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded">
                4. Impact &amp; Blast Radius
              </span>
              <h2 className="text-sm font-bold text-white">Call Graph &amp; Traversal Scope</h2>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/impact?issueId=${issue.id}`)}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <span>Explore Full Impact</span>
              <ExternalLink size={12} />
            </Button>
          </div>

          <div className="p-5 space-y-5">
            {impactStatus === 'loading' && (
              <div className="flex items-center justify-center py-8 gap-2 text-[hsl(var(--muted-foreground))]">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-xs font-medium">Tracing call graph and affected symbols…</span>
              </div>
            )}

            {impactStatus === 'error' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-800/40 bg-amber-950/20 p-3.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-[hsl(var(--foreground))]">
                  {impactError ?? 'Call graph impact details could not be traced for this symbol.'}
                </p>
              </div>
            )}

            {impactStatus === 'ready' && impactMap && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_250px] gap-5">
                <div className="space-y-4">
                  <ImpactMapViz impactMap={impactMap} findingTitle={issue.finding.title} />
                  <AffectedFiles impactMap={impactMap} />
                </div>
                <ImpactSummary impactMap={impactMap} />
              </div>
            )}
          </div>
        </div>

        {/* 5. RELATED TESTS */}
        <RelatedTests
          issueTests={issue.relatedTests}
          impactTests={impactStatus === 'ready' && impactMap ? impactMap.relatedTests : []}
          hasFailingTest={issue.hasFailingTest}
        />

        {/* 6. REPAIR WORKFLOW */}
        {snapshot && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-0.5 rounded">
                6. Guided Repair
              </span>
              <h2 className="text-base font-bold text-white">Remediation &amp; Proof</h2>
            </div>
            <RepairWorkflow issue={issue} beforeSnapshot={snapshot} projectPath={project.path} />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
