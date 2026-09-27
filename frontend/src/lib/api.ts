import type { AnalyzeResponse, ProjectReport, ImpactMap, RepairPlan, ReviewResult, RepairRecord, AnalysisSnapshot } from '@/types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

// ── SSE stream consumer ───────────────────────────────────────────────
// Reads a Server-Sent Events response and calls handlers per event type.
// The stream endpoints (repair/plan, /run, /review) all emit named events.

export interface SseHandlers {
  onStatus?: (data: { stage: string; message: string }) => void
  onChunk?: (data: { text: string }) => void
  onPlan?: (plan: RepairPlan) => void
  onReview?: (review: ReviewResult) => void
  onDone?: (data: { success: boolean; error?: string }) => void
  onError?: (data: { message: string; bobUnavailable?: boolean }) => void
}

export async function streamSse(
  path: string,
  body: Record<string, unknown>,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }))
    const msg = (errorBody as { error?: string }).error ?? res.statusText
    handlers.onError?.({ message: msg })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // Parse SSE frames: "event: <name>\ndata: <json>\n\n"
    const frames = buf.split('\n\n')
    buf = frames.pop() ?? ''

    for (const frame of frames) {
      const lines = frame.split('\n')
      let eventName = 'message'
      let dataStr = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim()
        if (line.startsWith('data: '))  dataStr  = line.slice(6).trim()
      }
      if (!dataStr) continue
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>
        switch (eventName) {
          case 'status':  handlers.onStatus?.(data as { stage: string; message: string }); break
          case 'chunk':   handlers.onChunk?.(data as { text: string }); break
          case 'plan':    handlers.onPlan?.(data as unknown as RepairPlan); break
          case 'review':  handlers.onReview?.(data as unknown as ReviewResult); break
          case 'done':    handlers.onDone?.(data as { success: boolean; error?: string }); break
          case 'error':   handlers.onError?.(data as { message: string; bobUnavailable?: boolean }); break
        }
      } catch { /* malformed JSON — skip */ }
    }
  }
}

// ── API surface ───────────────────────────────────────────────────────

export const api = {
  health: () =>
    request<{ status: string; service: string }>('/health'),

  analyze: (projectPath: string, force = false) =>
    request<AnalyzeResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectPath, force }),
    }),

  getReport: (projectPath: string) =>
    request<ProjectReport>(`/report?projectPath=${encodeURIComponent(projectPath)}`),

  generateReport: (
    projectPath: string,
    options?: { repairRecord?: RepairRecord; afterSnapshot?: AnalysisSnapshot },
  ) =>
    request<ProjectReport>('/report/generate', {
      method: 'POST',
      body: JSON.stringify({ projectPath, ...options }),
    }),

  getImpact: (issueId: string, projectPath: string) =>
    request<ImpactMap>(`/impact/${issueId}?projectPath=${encodeURIComponent(projectPath)}`),

  /** Run authentic verification: re-runs real tests and re-analyzes to compute before/after delta */
  verify: (projectPath: string) =>
    request<ProjectReport>('/repair/verify', {
      method: 'POST',
      body: JSON.stringify({ projectPath }),
    }),

  /** Check Bob availability without consuming tokens */
  repairStatus: () =>
    request<{ available: boolean; reason?: string }>('/repair/status'),

  /** Stream: repair plan generation (SSE) */
  streamRepairPlan: (
    projectPath: string,
    issueId: string,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ) => streamSse('/repair/plan', { projectPath, issueId }, handlers, signal),

  /** Stream: repair execution (SSE) */
  streamRepairRun: (
    projectPath: string,
    issueId: string,
    plan: RepairPlan,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ) => streamSse('/repair/run', { projectPath, issueId, plan }, handlers, signal),

  /** Stream: independent review (SSE) */
  streamRepairReview: (
    projectPath: string,
    issueId: string,
    plan: RepairPlan,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ) => streamSse('/repair/review', { projectPath, issueId, plan }, handlers, signal),

  /** Get the default demo project info */
  getDefaultProject: () =>
    request<{ path: string; displayName: string; typeLabel: string; isImported: boolean }>('/project/default'),

  /** Import a ZIP file as the active project with progress tracking. Returns new project info. */
  importProject: (file: File, onProgress?: (percent: number) => void) => {
    return new Promise<{ path: string; displayName: string; typeLabel: string; isImported: boolean; projectId: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const form = new FormData()
      form.append('project', file)

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100))
            onProgress(percent)
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(data)
          } catch {
            reject(new Error('Invalid response received from server.'))
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText)
            reject(new Error(errData.error || `Upload failed with status ${xhr.status}`))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      }

      xhr.onerror = () => reject(new Error('Network error occurred during project archive upload.'))
      xhr.open('POST', `${BASE}/project/import`)
      xhr.send(form)
    })
  },
}
