import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { PrioritizedIssue, ImpactMap, ProjectReport, AnalysisSnapshot } from '@/types'
import { PROJECT_PATH } from '@/lib/config'

export type IssueDetailStatus = 'loading' | 'ready' | 'not-found' | 'error'

export interface IssueDetailState {
  status: IssueDetailStatus
  issue: PrioritizedIssue | null
  snapshot: AnalysisSnapshot | null
  impactMap: ImpactMap | null
  impactStatus: 'loading' | 'ready' | 'error' | 'idle'
  error: string | null
  impactError: string | null
}

export function useIssueDetail(issueId: string | undefined, projectPath = PROJECT_PATH) {
  const [state, setState] = useState<IssueDetailState>({
    status: 'loading',
    issue: null,
    snapshot: null,
    impactMap: null,
    impactStatus: 'idle',
    error: null,
    impactError: null,
  })

  useEffect(() => {
    if (!issueId) {
      setState(s => ({ ...s, status: 'not-found', error: 'No issue ID provided.' }))
      return
    }

    let cancelled = false

    async function load() {
      setState(s => ({ ...s, status: 'loading', error: null }))
      try {
        // Load the report which contains all findings
        const report: ProjectReport = await api.getReport(projectPath)
        if (cancelled) return

        // Find the issue by id — check prioritizedIssues first, then findings
        const prioritized = report.snapshot.prioritizedIssues.find(i => i.id === issueId)
        const findingMatch = prioritized ?? (() => {
          const f = report.snapshot.findings.find(f => f.id === issueId)
          return f ? ({ id: issueId, finding: f, score: 0, blastRadius: 0, hasFailingTest: false, relatedTests: [] } as PrioritizedIssue) : null
        })()

        if (!findingMatch) {
          setState(s => ({ ...s, status: 'not-found', error: `Issue "${issueId}" not found in current analysis.` }))
          return
        }

        setState(s => ({ ...s, status: 'ready', issue: findingMatch, snapshot: report.snapshot, impactStatus: 'loading' }))

        // Load impact data
        try {
          const impact = await api.getImpact(issueId!, projectPath)
          if (!cancelled) setState(s => ({ ...s, impactMap: impact, impactStatus: 'ready' }))
        } catch (impErr) {
          if (!cancelled) setState(s => ({
            ...s,
            impactStatus: 'error',
            impactError: (impErr as Error).message,
          }))
        }
      } catch (err) {
        if (!cancelled) setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [issueId, projectPath])

  return state
}
