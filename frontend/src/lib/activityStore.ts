/**
 * Activity Store — Real audit log of engineering actions in VECTRA.
 *
 * Persisted in localStorage so events survive page navigation & refreshes.
 * Strictly real events:
 * - Project imported
 * - Analysis completed
 * - Report generated
 * - Verification run
 * No fabricated events.
 */

import { useState, useEffect, useCallback } from 'react'

export interface ActivityEvent {
  id: string
  type: 'project_imported' | 'analysis_completed' | 'report_generated' | 'verification_completed'
  title: string
  description?: string
  projectName: string
  timestamp: string
  metadata?: Record<string, unknown>
}

const STORAGE_KEY = 'vectra_activity_log_v1'
const MAX_EVENTS = 20

function loadStoredEvents(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ActivityEvent[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function saveEvents(events: ActivityEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    // ignore
  }
}

// Global subscribers for multi-component reactivity
const listeners = new Set<(events: ActivityEvent[]) => void>()

export function logActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>) {
  const newEvent: ActivityEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  }

  const existing = loadStoredEvents()
  const updated = [newEvent, ...existing].slice(0, MAX_EVENTS)
  saveEvents(updated)
  listeners.forEach(cb => cb(updated))
}

export function clearActivityLog() {
  saveEvents([])
  listeners.forEach(cb => cb([]))
}

export function useActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>(loadStoredEvents)

  useEffect(() => {
    const handleUpdate = (updated: ActivityEvent[]) => setEvents(updated)
    listeners.add(handleUpdate)
    return () => {
      listeners.delete(handleUpdate)
    }
  }, [])

  const log = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    logActivity(event)
  }, [])

  return { events, logActivity: log, clearLog: clearActivityLog }
}
