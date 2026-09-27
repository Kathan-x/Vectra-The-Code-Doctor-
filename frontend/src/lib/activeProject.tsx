/**
 * ActiveProjectContext — single source of truth for which project VECTRA is analyzing.
 *
 * All pages read from this context. The project can be changed via:
 * - ZIP import (POST /api/project/import)
 * - Switch back to demo target
 *
 * Persisted in localStorage so page refreshes maintain the active target.
 * The raw filesystem path is kept internal. The UI only displays friendly labels.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { DEFAULT_PROJECT_PATH, DEFAULT_PROJECT_DISPLAY_NAME, DEFAULT_PROJECT_TYPE_LABEL } from '@/lib/config'

export interface ActiveProject {
  /** Absolute path used by the backend — never displayed to user as primary identity */
  path: string
  /** Human-readable name shown everywhere in the UI */
  displayName: string
  /** Short tech descriptor, e.g. "Node.js · Express" */
  typeLabel: string
  /** Whether this was imported by the user (vs. the built-in demo) */
  isImported: boolean
  /** Optional unique project ID */
  projectId?: string
}

interface ActiveProjectContextValue {
  project: ActiveProject
  setProject: (p: ActiveProject) => void
  resetToDefault: () => void
}

const STORAGE_KEY = 'vectra_active_project_v1'

const DEFAULT: ActiveProject = {
  path:        DEFAULT_PROJECT_PATH,
  displayName: DEFAULT_PROJECT_DISPLAY_NAME,
  typeLabel:   DEFAULT_PROJECT_TYPE_LABEL,
  isImported:  false,
}

function loadInitialProject(): ActiveProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveProject
      if (parsed.path && parsed.displayName) return parsed
    }
  } catch {
    // ignore json or storage errors
  }
  return DEFAULT
}

const ActiveProjectContext = createContext<ActiveProjectContextValue>({
  project:        DEFAULT,
  setProject:     () => {},
  resetToDefault: () => {},
})

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProjectState] = useState<ActiveProject>(loadInitialProject)

  const setProject = useCallback((p: ActiveProject) => {
    setProjectState(p)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } catch {
      // ignore
    }
  }, [])

  const resetToDefault = useCallback(() => {
    setProjectState(DEFAULT)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  // Sync to local storage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } catch {
      // ignore
    }
  }, [project])

  return (
    <ActiveProjectContext.Provider value={{ project, setProject, resetToDefault }}>
      {children}
    </ActiveProjectContext.Provider>
  )
}

export function useActiveProject(): ActiveProjectContextValue {
  return useContext(ActiveProjectContext)
}
