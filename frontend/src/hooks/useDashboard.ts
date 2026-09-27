import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ProjectReport } from '@/types'

export type DashboardStatus = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error'

export interface DashboardState {
  status: DashboardStatus
  report: ProjectReport | null
  error: string | null
  projectPath: string
  lastAnalyzedAt: string | null
}

const DEFAULT_PATH = import.meta.env.VITE_SAMPLE_APP_PATH ?? ''

export function useDashboard(initialPath = DEFAULT_PATH) {
  const [state, setState] = useState<DashboardState>({
    status: 'idle',
    report: null,
    error: null,
    projectPath: initialPath,
    lastAnalyzedAt: null,
  })

  const setProjectPath = useCallback((path: string) => {
    setState(s => ({ ...s, projectPath: path }))
  }, [])

  // Try to load an existing report on mount or path change
  const loadExistingReport = useCallback(async (path: string) => {
    if (!path) return
    setState(s => ({ ...s, status: 'loading', error: null }))
    try {
      const report = await api.getReport(path)
      setState(s => ({
        ...s,
        status: 'ready',
        report,
        lastAnalyzedAt: report.createdAt,
      }))
    } catch {
      // No report yet — stay idle so empty state shows
      setState(s => ({ ...s, status: 'idle', report: null }))
    }
  }, [])

  useEffect(() => {
    setState(s => ({ ...s, projectPath: initialPath }))
    if (initialPath) {
      loadExistingReport(initialPath)
    }
  }, [initialPath, loadExistingReport])

  const analyze = useCallback(async (force = false) => {
    const projectPath = state.projectPath || initialPath
    if (!projectPath) {
      setState(s => ({ ...s, error: 'Please enter or select a project path first.' }))
      return
    }
    setState(s => ({ ...s, status: 'analyzing', error: null }))
    try {
      // Run analysis
      await api.analyze(projectPath, force)
      // Generate report from fresh analysis
      const report = await api.generateReport(projectPath)
      setState(s => ({
        ...s,
        status: 'ready',
        report,
        lastAnalyzedAt: new Date().toISOString(),
        error: null,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }))
    }
  }, [state.projectPath, initialPath])

  return { state, setProjectPath, analyze, reload: () => loadExistingReport(state.projectPath || initialPath) }
}
