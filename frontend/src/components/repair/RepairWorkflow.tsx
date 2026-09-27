/**
 * RepairWorkflow — main orchestrator for the guided repair → review → verify workflow.
 *
 * Always displays the 4-stage pipeline:
 *   1. PLAN   (Context synthesis & repair plan generation)
 *   2. REPAIR (Bounded file modification via IBM Bob)
 *   3. REVIEW (Independent second-pass review of real file diff on disk)
 *   4. VERIFY (Deterministic local test execution & before/after delta proof)
 *
 * Honestly communicates IBM Bob availability:
 * - If CURSOR_API_KEY is not configured: displays a professional "IBM Bob Setup Required" notice
 *   without hiding the workflow pipeline.
 * - Allows local verification to run independently at any time.
 */

import type { PrioritizedIssue, AnalysisSnapshot, RepairRecord, BeforeAfterDelta } from '@/types'
import { useRepairWorkflow } from '@/hooks/useRepairWorkflow'
import { RepairPlanPanel } from './RepairPlanPanel'
import { RepairProgress } from './RepairProgress'
import { RepairChanges } from './RepairChanges'
import { ReviewResultPanel } from './ReviewResultPanel'
import { VerificationResult } from './VerificationResult'
import { Button } from '@/components/ui/button'
import {
  Wrench, AlertTriangle,
  CheckCircle2, FlaskConical, Loader2, Sparkles,
  KeyRound, ShieldCheck, ShieldAlert, ShieldX, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RepairWorkflowProps {
  issue: PrioritizedIssue
  beforeSnapshot: AnalysisSnapshot
  projectPath?: string
  existingRepair?: RepairRecord | null
  reportDelta?: BeforeAfterDelta | null
  reportAfterSnapshot?: AnalysisSnapshot | null
  onWorkflowUpdated?: () => Promise<void> | void
}

export function RepairWorkflow({
  issue,
  beforeSnapshot,
  projectPath,
  existingRepair,
  reportDelta,
  reportAfterSnapshot,
  onWorkflowUpdated,
}: RepairWorkflowProps) {
  const {
    stage, bobAvailable,
    log, plan, reviewResult, afterSnapshot, errorMessage,
    generatePlan, runRepair, runReview, runVerification, reset,
  } = useRepairWorkflow(issue.id, {
    projectPath,
    initialBeforeSnapshot: beforeSnapshot,
    existingRepair,
    reportDelta,
    reportAfterSnapshot,
    findingFingerprint: existingRepair?.findingFingerprint,
    onWorkflowUpdated,
  })

  const isCheckingBob = stage === 'checking_bob'
  const isPlanning    = stage === 'planning'
  const isRepairing   = stage === 'repairing'
  const isReviewing   = stage === 'reviewing'
  const isVerifying   = stage === 'verifying'

  const hasPlan    = !!plan
  const isRepaired = !!existingRepair?.appliedAt || stage === 'repair_done' || stage === 'reviewing' || stage === 'review_done' || stage === 'verifying' || stage === 'verified' || stage === 'verification_failed'

  // Independent Review truth states:
  // Must ONLY be marked as reviewed if an actual ReviewResult exists!
  const hasReviewResult  = !!reviewResult
  const isReviewPassed   = reviewResult?.status === 'approved'
  const isReviewConcerns = reviewResult?.status === 'concerns'
  const isReviewBlocked  = reviewResult?.status === 'blocked'
  const isReviewError    = stage === 'review_error'

  const isVerified           = stage === 'verified'
  const isVerificationFailed = stage === 'verification_failed'

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm">
      {/* Workflow Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <Wrench size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              IBM Bob Repair Workflow
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Guided 4-stage remediation pipeline for {issue.finding.title}
            </p>
          </div>
        </div>

        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          {isCheckingBob ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] px-2.5 py-1 rounded-md border border-[hsl(var(--border))]">
              <Loader2 size={13} className="animate-spin" />
              Checking Bob…
            </span>
          ) : bobAvailable ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-3 py-1 rounded-md border border-emerald-800/50 bg-emerald-950/40">
              <CheckCircle2 size={13} />
              IBM Bob Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 px-3 py-1 rounded-md border border-amber-800/50 bg-amber-950/40">
              <KeyRound size={13} />
              IBM Bob Setup Required
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Setup Required Notice (if Bob is not configured) */}
        {!bobAvailable && !isCheckingBob && (
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <KeyRound size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  IBM Bob Credentials Required for Automated Code Generation
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                  The automated repair plan, code execution, and independent review steps use the IBM Bob integration via <code className="text-amber-300 font-mono">@cursor/sdk</code>.
                  To activate live AI generation, set the <code className="text-amber-300 font-mono">CURSOR_API_KEY</code> environment variable on your backend server.
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  <strong>Local Verification remains fully active:</strong> You can run Stage 4 (Verification) at any time to execute the Jest test suite and deterministic AST checks locally.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4-Stage Stepper Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stage 1: PLAN */}
          <div className={cn(
            'rounded-xl border p-4 transition-all',
            hasPlan ? 'border-emerald-800/50 bg-emerald-950/20' :
            isPlanning ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500' :
            'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">1. PLAN</span>
              {hasPlan ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isPlanning ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-mono">Stage 1</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">Targeted Repair Plan</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              Synthesizes AST context, blast radius, and generates ordered file edit instructions.
            </p>
          </div>

          {/* Stage 2: REPAIR */}
          <div className={cn(
            'rounded-xl border p-4 transition-all',
            isRepaired ? 'border-emerald-800/50 bg-emerald-950/20' :
            isRepairing ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500' :
            'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">2. REPAIR</span>
              {isRepaired ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isRepairing ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-mono">Stage 2</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">Bounded Modification</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              Applies targeted transformations with pre-edit file snapshots and boundary enforcement.
            </p>
          </div>

          {/* Stage 3: REVIEW */}
          <div className={cn(
            'rounded-xl border p-4 transition-all',
            isReviewPassed ? 'border-emerald-800/50 bg-emerald-950/20' :
            isReviewConcerns ? 'border-amber-800/50 bg-amber-950/20' :
            isReviewBlocked || isReviewError ? 'border-red-800/50 bg-red-950/20' :
            isReviewing ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500' :
            isRepaired ? 'border-amber-800/40 bg-amber-950/15' :
            'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">3. REVIEW</span>
              {isReviewPassed ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isReviewConcerns ? (
                <ShieldAlert size={16} className="text-amber-400" />
              ) : isReviewBlocked || isReviewError ? (
                <ShieldX size={16} className="text-red-400" />
              ) : isReviewing ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : isRepaired ? (
                <span className="text-[10px] text-amber-400 uppercase font-mono font-semibold">Pending</span>
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-mono">Stage 3</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">
              {isReviewing ? 'Review Running' :
               isReviewPassed ? 'Review Passed' :
               isReviewConcerns ? 'Review Found Concerns' :
               isReviewBlocked ? 'Review Blocked' :
               isReviewError ? 'Review Failed' :
               isRepaired ? 'Review Pending' :
               'Independent Review'}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              {isReviewing ? 'Analyzing AST diff and inspecting modified code for risks…' :
               isReviewPassed ? 'Independent inspection confirmed clean diff with zero security regressions.' :
               isReviewConcerns ? `${reviewResult?.concerns.length ?? 0} concern(s) flagged in the applied diff.` :
               isReviewBlocked ? 'Review blocked modification due to critical regression risks.' :
               isReviewError ? 'Secondary pass encountered an error during AST diff review.' :
               isRepaired ? 'Modifications applied to disk. Awaiting independent review.' :
               'Secondary inspection checking for security anti-patterns and regressions.'}
            </p>
          </div>

          {/* Stage 4: VERIFY */}
          <div className={cn(
            'rounded-xl border p-4 transition-all',
            isVerified ? 'border-emerald-800/50 bg-emerald-950/20' :
            isVerificationFailed ? 'border-red-800/50 bg-red-950/20' :
            isVerifying ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500' :
            'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)]'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">4. VERIFY</span>
              {isVerified ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : isVerificationFailed ? (
                <XCircle size={16} className="text-red-400" />
              ) : isVerifying ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-mono">Stage 4</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">
              {isVerifying ? 'Verifying Tests…' :
               isVerified ? 'Verification Passed' :
               isVerificationFailed ? 'Verification Failed' :
               'Local Test Proof'}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">
              {isVerifying ? 'Executing target test runner and calculating AST delta proof…' :
               isVerified ? 'Tests executed cleanly and target defect was confirmed resolved.' :
               isVerificationFailed ? 'Defect still detected in AST or test suite reported failures.' :
               'Re-executes test suites and re-analyzes code to mathematically prove the fix.'}
            </p>
          </div>
        </div>

        {/* Detailed Stage Execution Workspace */}
        <div className="space-y-6 pt-2">
          {/* STAGE 1: PLAN WORKSPACE */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs">
                  1
                </span>
                <h3 className="text-base font-bold text-white">
                  Plan Repair
                </h3>
              </div>

              {bobAvailable ? (
                <Button
                  variant="default"
                  size="md"
                  onClick={generatePlan}
                  disabled={isPlanning}
                  className="gap-2 font-semibold shadow-sm"
                >
                  <Sparkles size={15} />
                  <span>{isPlanning ? 'Synthesizing Plan…' : hasPlan ? 'Regenerate Plan' : 'Generate Repair Plan'}</span>
                </Button>
              ) : (
                <span className="text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg">
                  Requires CURSOR_API_KEY on backend
                </span>
              )}
            </div>

            {hasPlan && plan && (
              <RepairPlanPanel
                plan={plan}
                issueTitle={issue.finding.title}
                issueSeverity={issue.finding.severity}
                onApprove={() => runRepair(plan)}
                onDiscard={reset}
                disabled={isRepairing}
              />
            )}

            {!hasPlan && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                When triggered, IBM Bob in Plan mode evaluates the finding evidence (<code className="font-mono text-white">{issue.finding.file}:{issue.finding.line}</code>)
                and the call-graph impact to generate a minimal, safe diff plan.
              </p>
            )}
          </div>

          {/* STAGE 2: REPAIR WORKSPACE */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs">
                  2
                </span>
                <h3 className="text-base font-bold text-white">
                  Apply Repair
                </h3>
              </div>

              {bobAvailable && hasPlan && plan && !isRepaired && (
                <Button
                  variant="default"
                  size="md"
                  onClick={() => runRepair(plan)}
                  disabled={isRepairing}
                  className="gap-2 font-semibold shadow-sm"
                >
                  <Wrench size={15} />
                  <span>{isRepairing ? 'Applying Edits…' : 'Apply Repair'}</span>
                </Button>
              )}
            </div>

            {isRepairing && (
              <RepairProgress log={log} stage={stage} />
            )}

            {isRepaired && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-800/40 px-4 py-2.5 rounded-lg">
                  <CheckCircle2 size={16} />
                  <span>Repair transformations successfully applied to target project.</span>
                </div>
                {plan && <RepairChanges plan={plan} />}
              </div>
            )}

            {!isRepaired && !isRepairing && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Executes the approved plan within the target workspace. File backups and snapshot tracking ensure full roll-back safety.
              </p>
            )}
          </div>

          {/* STAGE 3: REVIEW WORKSPACE */}
          <div className={cn(
            'rounded-xl border p-6 space-y-4 transition-all',
            isReviewPassed ? 'border-emerald-800/40 bg-emerald-950/10' :
            isReviewConcerns ? 'border-amber-800/40 bg-amber-950/10' :
            isReviewBlocked || isReviewError ? 'border-red-800/40 bg-red-950/10' :
            'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
          )}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg font-bold text-xs',
                  isReviewPassed ? 'bg-emerald-600/20 text-emerald-400' :
                  isReviewConcerns ? 'bg-amber-600/20 text-amber-400' :
                  isReviewBlocked || isReviewError ? 'bg-red-600/20 text-red-400' :
                  'bg-blue-600/20 text-blue-400'
                )}>
                  3
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Independent Review
                    {isReviewPassed && (
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                        Approved
                      </span>
                    )}
                    {isReviewConcerns && (
                      <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                        Concerns Noted
                      </span>
                    )}
                    {isReviewBlocked && (
                      <span className="text-[11px] font-semibold text-red-400 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded">
                        Blocked
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Independent secondary AI pass inspecting the real file diff on disk for regressions
                  </p>
                </div>
              </div>

              {bobAvailable && isRepaired && (plan || existingRepair?.plan) && (
                <Button
                  variant={isReviewPassed ? 'outline' : 'default'}
                  size="md"
                  onClick={() => runReview((plan ?? existingRepair?.plan) ?? undefined)}
                  disabled={isReviewing}
                  className="gap-2 font-semibold shadow-sm"
                >
                  <ShieldCheck size={15} className={isReviewing ? 'animate-spin' : ''} />
                  <span>{isReviewing ? 'Reviewing Changes…' : hasReviewResult ? 'Re-run Review' : 'Run Independent Review'}</span>
                </Button>
              )}
            </div>

            {isReviewing && (
              <RepairProgress log={log} stage={stage} />
            )}

            {hasReviewResult && reviewResult && (
              <ReviewResultPanel review={reviewResult} />
            )}

            {!hasReviewResult && !isReviewing && isRepaired && (
              <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                  <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                  <span>Review Pending for Applied Modifications</span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Stage 2 has applied the modification to the target source file. An independent second pass should now inspect the real AST diff to verify that no new vulnerabilities, syntax errors, or regression risks were introduced.
                </p>
              </div>
            )}

            {!hasReviewResult && !isReviewing && !isRepaired && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                An independent second pass with strict reviewer instructions inspects the AST diff on disk to ensure no new vulnerabilities or regression risks were introduced.
              </p>
            )}
          </div>

          {/* STAGE 4: VERIFICATION WORKSPACE (Local execution enabled!) */}
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                  4
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Test Verification &amp; Delta Proof
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Runs target test runner and re-runs deterministic AST analysis
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="md"
                onClick={runVerification}
                disabled={isVerifying}
                className="gap-2 font-bold shadow-md bg-blue-600 hover:bg-blue-500 text-white"
              >
                <FlaskConical size={16} className={isVerifying ? 'animate-spin' : ''} />
                <span>{isVerifying ? 'Verifying with Local Tests…' : 'Run Verification Now'}</span>
              </Button>
            </div>

            {/* Verification Result Display */}
            {(isVerifying || afterSnapshot) && (
              <div className="pt-2">
                <VerificationResult
                  before={beforeSnapshot}
                  after={afterSnapshot}
                  issueId={issue.id}
                  stage={stage}
                  delta={reportDelta}
                  findingFingerprint={existingRepair?.findingFingerprint}
                />
              </div>
            )}

            {!isVerifying && !afterSnapshot && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                Verification executes the project&apos;s real test suites (<code className="font-mono text-white">npm test</code> / <code className="font-mono text-white">node --test</code>)
                and checks whether failing tests now pass, and whether the finding was resolved in the AST.
              </p>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-red-300">
              <AlertTriangle size={18} className="text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
