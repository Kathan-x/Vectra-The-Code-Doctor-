import { useEffect, useRef } from 'react'
import type { RepairLogEntry } from '@/hooks/useRepairWorkflow'
import { Loader2, Terminal } from 'lucide-react'

interface RepairProgressProps {
  log: RepairLogEntry[]
  stage: string
  label?: string
}

const CHUNK_STYLE = 'text-[hsl(var(--foreground))] leading-relaxed'
const STATUS_STYLE = 'text-blue-400 font-medium'
const INFO_STYLE   = 'text-[hsl(var(--muted-foreground))]'
const ERROR_STYLE  = 'text-red-400'

export function RepairProgress({ log, stage, label }: RepairProgressProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Scroll ONLY the internal terminal container, never the window viewport
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [log.length])

  const isActive = ['planning', 'repairing', 'reviewing', 'verifying'].includes(stage)

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <Terminal size={14} className="text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-white">{label ?? 'IBM Bob Activity'}</h2>
        {isActive && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-blue-400">
            <Loader2 size={11} className="animate-spin" />
            working…
          </span>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="h-[240px] overflow-y-auto px-4 py-3 font-mono text-[11px] leading-5 space-y-0.5"
          aria-live="polite"
          aria-label="IBM Bob activity log"
        >
          {log.length === 0 ? (
            <span className="text-[hsl(var(--muted-foreground))]">Waiting for IBM Bob…</span>
          ) : (
            log.map((entry, i) => (
              <div key={i} className={
                entry.type === 'chunk'  ? CHUNK_STYLE  :
                entry.type === 'status' ? STATUS_STYLE :
                entry.type === 'error'  ? ERROR_STYLE  :
                INFO_STYLE
              }>
                {entry.type === 'status' && <span className="text-[hsl(var(--muted-foreground))] mr-1">›</span>}
                {entry.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
