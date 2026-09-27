/**
 * useRepairWorkflow — state machine for the full repair → review → verify cycle.
 *
 * Stages (in order):
 *   idle → planning → plan_ready → confirming → repairing → repair_done
 *   → reviewing → review_done → verifying → verified | verification_failed
 *
 * Error states: plan_error | repair_error | review_error | verify_error
 * Also handles: bob_unavailable
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { RepairPlan, ReviewResult, AnalysisSnapshot, RepairRecord, BeforeAfterDelta } from '@/types'
import { PROJECT_PATH } from '@/lib/config'

export type RepairStage =
  | 'idle'
  | 'checking_bob'
  | 'bob_unavailable'
  | 'planning'
  | 'plan_ready'
  | 'repairing'
  | 'repair_done'
  | 'reviewing'
  | 'review_done'
  | 'verifying'
  | 'verified'
  | 'verification_failed'
  | 'plan_error'
  | 'repair_error'
  | 'review_error'
  | 'verify_error'

export interface RepairLogEntry {
  type: 'status' | 'chunk' | 'info' | 'error'
  text: string
  ts: number
}

export interface RepairWorkflowState {
  stage: RepairStage
  /** Bob availability (checked once on mount) */
  bobAvailable: boolean | null
  bobUnavailableReason: string | null
  /** Streaming Bob log */
  log: RepairLogEntry[]
  /** Generated repair plan */
  plan: RepairPlan | null
  /** Review result from Bob */
  reviewResult: ReviewResult | null
  /** Snapshot before repair (from report cache) */
  beforeSnapshot: AnalysisSnapshot | null
  /** Snapshot after re-analysis */
  afterSnapshot: AnalysisSnapshot | null
  /** Error message for current error stage */
  errorMessage: string | null
}

export interface UseRepairWorkflowOptions {
  projectPath?: string
  initialBeforeSnapshot?: AnalysisSnapshot | null
  existingRepair?: RepairRecord | null
  reportDelta?: BeforeAfterDelta | null
  reportAfterSnapshot?: AnalysisSnapshot | null
  findingFingerprint?: string | null
  onWorkflowUpdated?: () => Promise<void> | void
}

export function useRepairWorkflow(
  issueId: string,
  projectPathOrOptions: string | UseRepairWorkflowOptions = PROJECT_PATH,
  legacySnapshot?: AnalysisSnapshot | null,
) {
  const options: UseRepairWorkflowOptions =
    typeof projectPathOrOptions === 'string'
      ? { projectPath: projectPathOrOptions, initialBeforeSnapshot: legacySnapshot }
      : projectPathOrOptions

  const projectPath = options.projectPath ?? PROJECT_PATH
  const initialBefore = options.initialBeforeSnapshot ?? legacySnapshot ?? null
  const existingRepair = options.existingRepair ?? null
  const reportAfter = options.reportAfterSnapshot ?? null
  const reportDelta = options.reportDelta ?? null
  const findingFingerprint = options.findingFingerprint ?? existingRepair?.findingFingerprint ?? null
  const onWorkflowUpdated = options.onWorkflowUpdated

  const getInitialStage = (): RepairStage => {
    if (existingRepair?.workflowStage) {
      if (existingRepair.workflowStage === 'verification_passed') return 'verified'
      if (existingRepair.workflowStage === 'verification_failed' || existingRepair.workflowStage === 'verification_partial') return 'verification_failed'
      if (existingRepair.workflowStage === 'review_passed' || existingRepair.workflowStage === 'review_failed') return 'review_done'
      if (existingRepair.workflowStage === 'review_pending' || existingRepair.workflowStage === 'repair_applied') return 'repair_done'
      if (existingRepair.workflowStage === 'plan_ready') return 'plan_ready'
    }
    // Only infer verification outcome if a repair was actually applied for this issue
    if (existingRepair?.appliedAt && reportAfter) {
      const isResolved = (reportDelta?.resolvedFindingIds.includes(issueId) ?? false) ||
        (findingFingerprint ? (reportDelta?.resolvedFingerprints?.includes(findingFingerprint) ?? false) : false)
      return isResolved ? 'verified' : 'verification_failed'
    }
    if (existingRepair?.reviewResult) {
      return 'review_done'
    }
    if (existingRepair?.appliedAt) {
      return 'repair_done'
    }
    if (existingRepair?.plan) {
      return 'plan_ready'
    }
    return 'idle'
  }

  const [state, setState] = useState<RepairWorkflowState>({
    stage: getInitialStage(),
    bobAvailable: null,
    bobUnavailableReason: null,
    log: [],
    plan: existingRepair?.plan ?? null,
    reviewResult: existingRepair?.reviewResult ?? null,
    beforeSnapshot: initialBefore,
    afterSnapshot: reportAfter,
    errorMessage: null,
  })

  // Sync baseline snapshot if it updates
  useEffect(() => {
    if (initialBefore) {
      setState(s => ({ ...s, beforeSnapshot: initialBefore }))
    }
  }, [initialBefore])

  // Sync persisted report state when active issue changes or report is reloaded
  useEffect(() => {
    setState(s => {
      // Do not interrupt active running operations
      if (s.stage === 'planning' || s.stage === 'repairing' || s.stage === 'reviewing' || s.stage === 'verifying') {
        return s
      }

      let stage: RepairStage = 'idle'
      if (existingRepair?.workflowStage) {
        if (existingRepair.workflowStage === 'verification_passed') stage = 'verified'
        else if (existingRepair.workflowStage === 'verification_failed' || existingRepair.workflowStage === 'verification_partial') stage = 'verification_failed'
        else if (existingRepair.workflowStage === 'review_passed' || existingRepair.workflowStage === 'review_failed') stage = 'review_done'
        else if (existingRepair.workflowStage === 'review_pending' || existingRepair.workflowStage === 'repair_applied') stage = 'repair_done'
        else if (existingRepair.workflowStage === 'plan_ready') stage = 'plan_ready'
      } else if (existingRepair?.appliedAt && reportAfter) {
        const isResolved = (reportDelta?.resolvedFindingIds.includes(issueId) ?? false) ||
          (findingFingerprint ? (reportDelta?.resolvedFingerprints?.includes(findingFingerprint) ?? false) : false)
        stage = isResolved ? 'verified' : 'verification_failed'
      } else if (existingRepair?.reviewResult) {
        stage = 'review_done'
      } else if (existingRepair?.appliedAt) {
        stage = 'repair_done'
      } else if (existingRepair?.plan) {
        stage = 'plan_ready'
      }

      return {
        ...s,
        stage,
        plan: existingRepair?.plan ?? s.plan,
        reviewResult: existingRepair?.reviewResult ?? s.reviewResult,
        afterSnapshot: reportAfter ?? s.afterSnapshot,
      }
    })
  }, [existingRepair, reportAfter, reportDelta, issueId, findingFingerprint])

  // Abort controller for the active SSE stream
  const abortRef = useRef<AbortController | null>(null)

  // Cancel any running stream on unmount
  useEffect(() => () => { abortRef.current?.abort() }, [])

  const appendLog = useCallback((type: RepairLogEntry['type'], text: string) => {
    setState(s => ({ ...s, log: [...s.log, { type, text, ts: Date.now() }] }))
  }, [])

  // ── Check Bob availability ─────────────────────────────────────────
  const checkBob = useCallback(async () => {
    setState(s => ({ ...s, stage: s.stage === 'idle' ? 'checking_bob' : s.stage }))
    try {
      const status = await api.repairStatus()
      if (!status.available) {
        setState(s => ({
          ...s,
          stage: 'bob_unavailable',
          bobAvailable: false,
          bobUnavailableReason: status.reason ?? 'IBM Bob is not configured.',
        }))
      } else {
        setState(s => ({
          ...s,
          stage: s.stage === 'checking_bob' ? 'idle' : s.stage,
          bobAvailable: true,
        }))
      }
    } catch {
      setState(s => ({
        ...s,
        stage: 'bob_unavailable',
        bobAvailable: false,
        bobUnavailableReason: 'Could not reach the backend.',
      }))
    }
  }, [])

  // Check Bob on first render
  useEffect(() => { void checkBob() }, [checkBob])

  // ── Stage 1: Plan ─────────────────────────────────────────────────
  const generatePlan = useCallback(async () => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setState(s => ({ ...s, stage: 'planning', log: [], plan: null, errorMessage: null }))
    appendLog('info', 'Requesting repair plan from IBM Bob…')

    let receivedPlan: RepairPlan | null = null

    await api.streamRepairPlan(projectPath, issueId, {
      onStatus: d => appendLog('status', d.message),
      onChunk:  d => appendLog('chunk', d.text),
      onPlan:   p => { receivedPlan = p },
      onDone:   d => {
        if (d.success && receivedPlan) {
          setState(s => ({ ...s, stage: 'plan_ready', plan: receivedPlan }))
        } else {
          setState(s => ({ ...s, stage: 'plan_error', errorMessage: d.error ?? 'Plan generation failed.' }))
        }
      },
      onError:  e => {
        const stage = e.bobUnavailable ? 'bob_unavailable' : 'plan_error'
        setState(s => ({
          ...s,
          stage,
          bobAvailable: e.bobUnavailable ? false : s.bobAvailable,
          errorMessage: e.message,
        }))
      },
    }, abort.signal)
  }, [projectPath, issueId, appendLog])

  // ── Stage 2: Run Repair ───────────────────────────────────────────
  const runRepair = useCallback(async (plan: RepairPlan) => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setState(s => ({ ...s, stage: 'repairing', log: [], errorMessage: null }))
    appendLog('info', 'IBM Bob is applying the repair to the target source…')

    await api.streamRepairRun(projectPath, issueId, plan, {
      onStatus: d => appendLog('status', d.message),
      onChunk:  d => appendLog('chunk', d.text),
      onDone:   d => {
        if (d.success) {
          appendLog('status', 'Repair applied to target project successfully. Ready for Independent Review.')
          setState(s => ({ ...s, stage: 'repair_done', errorMessage: null }))
          void onWorkflowUpdated?.()
        } else {
          setState(s => ({ ...s, stage: 'repair_error', errorMessage: d.error ?? 'Repair execution failed.' }))
        }
      },
      onError: e => {
        const stage = e.bobUnavailable ? 'bob_unavailable' : 'repair_error'
        setState(s => ({ ...s, stage, errorMessage: e.message }))
      },
    }, abort.signal)
  }, [projectPath, issueId, appendLog, onWorkflowUpdated])

  // ── Stage 3: Review ───────────────────────────────────────────────
  const runReview = useCallback(async (planToReview?: RepairPlan) => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    const effectivePlan = planToReview ?? state.plan ?? existingRepair?.plan
    if (!effectivePlan) {
      setState(s => ({ ...s, stage: 'review_error', errorMessage: 'No repair plan available to review.' }))
      return
    }

    setState(s => ({ ...s, stage: 'reviewing', reviewResult: null, errorMessage: null }))
    appendLog('info', 'IBM Bob is performing an independent second-pass review of the actual file diff on disk…')

    let received: ReviewResult | null = null

    await api.streamRepairReview(projectPath, issueId, effectivePlan, {
      onStatus: d => appendLog('status', d.message),
      onChunk:  d => appendLog('chunk', d.text),
      onReview: r => { received = r },
      onDone:   () => {
        appendLog('status', 'Independent review completed.')
        setState(s => ({ ...s, stage: 'review_done', reviewResult: received, errorMessage: null }))
        void onWorkflowUpdated?.()
      },
      onError:  e => {
        setState(s => ({ ...s, stage: 'review_error', errorMessage: e.message }))
      },
    }, abort.signal)
  }, [projectPath, issueId, state.plan, existingRepair?.plan, appendLog, onWorkflowUpdated])

  // ── Stage 4: Verify (re-analyze) ─────────────────────────────────
  const runVerification = useCallback(async () => {
    setState(s => ({ ...s, stage: 'verifying', errorMessage: null }))
    appendLog('info', 'Running verification: re-analyzing project with local test suite and AST checks…')
    try {
      const report = await api.verify(projectPath)
      const after = report.afterSnapshot ?? null
      const effectiveFingerprint = findingFingerprint ?? existingRepair?.findingFingerprint
      // Check if the targeted issue was genuinely resolved in the delta proof
      const isResolved = (report.delta?.resolvedFindingIds.includes(issueId) ?? false) ||
        (effectiveFingerprint ? (report.delta?.resolvedFingerprints?.includes(effectiveFingerprint) ?? false) : false)

      if (isResolved) {
        appendLog('status', 'Verification PASSED: Target finding was confirmed resolved without regressions.')
        setState(s => ({ ...s, stage: 'verified', afterSnapshot: after, errorMessage: null }))
      } else {
        appendLog('status', 'Verification completed: Target finding still persists in the modified project.')
        setState(s => ({
          ...s,
          stage: 'verification_failed',
          afterSnapshot: after,
          errorMessage: null,
        }))
      }
      void onWorkflowUpdated?.()
    } catch (err) {
      setState(s => ({
        ...s,
        stage: 'verify_error',
        errorMessage: (err as Error).message,
      }))
    }
  }, [projectPath, issueId, findingFingerprint, existingRepair, appendLog, onWorkflowUpdated])

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(s => ({
      ...s,
      stage: s.bobAvailable === false ? 'bob_unavailable' : 'idle',
      log: [],
      plan: null,
      reviewResult: null,
      afterSnapshot: null,
      errorMessage: null,
    }))
  }, [])

  return {
    ...state,
    generatePlan,
    runRepair,
    runReview,
    runVerification,
    reset,
  }
}
