import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FolderOpen, RefreshCw } from 'lucide-react'

interface AnalysisInputProps {
  value: string
  onChange: (path: string) => void
  onAnalyze: (force?: boolean) => void
  isAnalyzing: boolean
  hasExistingAnalysis: boolean
}

export function AnalysisInput({ value, onChange, onAnalyze, isAnalyzing, hasExistingAnalysis }: AnalysisInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(
        'flex items-center gap-2 rounded-lg border bg-[hsl(var(--input))] px-3 py-2 transition-colors',
        focused ? 'border-blue-500' : 'border-[hsl(var(--border))]'
      )}>
        <FolderOpen size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Absolute path to project directory…"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-[hsl(var(--muted-foreground))] outline-none font-mono"
          onKeyDown={e => { if (e.key === 'Enter' && !isAnalyzing) onAnalyze() }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="md"
          onClick={() => onAnalyze(false)}
          disabled={isAnalyzing || !value.trim()}
          className="gap-1.5"
        >
          <RefreshCw size={13} className={cn(isAnalyzing && 'animate-spin')} />
          {isAnalyzing ? 'Analyzing…' : 'Analyze Project'}
        </Button>
        {hasExistingAnalysis && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => onAnalyze(true)}
            disabled={isAnalyzing}
            className="gap-1.5 text-[hsl(var(--muted-foreground))]"
          >
            Force re-analyze
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  projectPath: string
  onPathChange: (p: string) => void
  onAnalyze: () => void
  isAnalyzing: boolean
}

export function EmptyState({ projectPath, onPathChange, onAnalyze, isAnalyzing }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <RefreshCw size={22} className="text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Analyze Your Project</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-8 leading-relaxed">
        Analyze your project to discover engineering risks, trace their impact,
        and prepare guided repairs.
      </p>
      <div className="w-full max-w-lg">
        <AnalysisInput
          value={projectPath}
          onChange={onPathChange}
          onAnalyze={onAnalyze}
          isAnalyzing={isAnalyzing}
          hasExistingAnalysis={false}
        />
      </div>
    </div>
  )
}

// ── Error state ──────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-800/40 bg-red-950/30">
        <span className="text-red-400 text-xl">!</span>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">Analysis Failed</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mb-6 font-mono">{message}</p>
      <Button variant="outline" size="md" onClick={onRetry} className="gap-1.5">
        <RefreshCw size={13} /> Retry
      </Button>
    </div>
  )
}

// ── Loading skeleton ─────────────────────────────────────────────────────

export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-40 rounded-xl bg-[hsl(var(--muted))]" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 rounded-xl bg-[hsl(var(--muted))]" />
        <div className="h-32 rounded-xl bg-[hsl(var(--muted))]" />
        <div className="h-32 rounded-xl bg-[hsl(var(--muted))]" />
      </div>
      <div className="h-64 rounded-xl bg-[hsl(var(--muted))]" />
    </div>
  )
}
