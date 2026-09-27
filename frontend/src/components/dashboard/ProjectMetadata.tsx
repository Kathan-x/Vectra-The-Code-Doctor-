import type { ProjectInfo } from '@/types'
import { Layers, Clock, FileCode, CheckCircle2 } from 'lucide-react'

interface ProjectMetadataProps {
  projectInfo: ProjectInfo
  analysisTimestamp: string
  reportTimestamp?: string | null
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

export function ProjectMetadata({ projectInfo, analysisTimestamp }: ProjectMetadataProps) {
  const langLabel = projectInfo.language === 'mixed' ? 'JavaScript & TypeScript' :
                    projectInfo.language === 'typescript' ? 'TypeScript' :
                    projectInfo.language === 'javascript' ? 'JavaScript' : projectInfo.language

  const techLine = [
    projectInfo.framework ? `${projectInfo.framework}` : null,
    langLabel !== 'unknown' ? langLabel : null,
    `${projectInfo.fileCount} source files`,
    `${projectInfo.testFiles.length} test suites`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 py-3.5 px-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-blue-400 shrink-0" />
          <span className="font-medium text-white">{techLine}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono">
            <FileCode size={13} className="text-[hsl(var(--muted-foreground))]" />
            <span>target: <strong className="text-[hsl(var(--foreground))]">{projectInfo.name}</strong></span>
          </span>

          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-[hsl(var(--muted-foreground))]" />
            <span>Analyzed {formatTs(analysisTimestamp)}</span>
          </span>

          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <CheckCircle2 size={13} />
            <span>Real Local Telemetry</span>
          </span>
        </div>
      </div>

      {/* Extended repository telemetry (scope & language composition) */}
      {(projectInfo.scope || (projectInfo.composition && projectInfo.composition.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 rounded-lg border border-[hsl(var(--border))/0.6] bg-[hsl(var(--card))/0.5] text-[11px] text-[hsl(var(--muted-foreground))]">
          {projectInfo.scope && (
            <div className="flex items-center gap-4 flex-wrap">
              <span>Scope: <strong className="text-white font-medium">{projectInfo.scope.analyzedFiles}</strong> analyzed files</span>
              <span>·</span>
              <span><strong className="text-white font-medium">{projectInfo.scope.totalFiles}</strong> active files</span>
              {projectInfo.scope.excludedFiles > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[hsl(var(--muted-foreground))]">
                    <strong className="text-[hsl(var(--muted-foreground))] font-medium">{projectInfo.scope.excludedFiles.toLocaleString()}</strong> build/deps excluded
                  </span>
                </>
              )}
            </div>
          )}

          {projectInfo.composition && projectInfo.composition.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[hsl(var(--muted-foreground))]">Composition:</span>
              {projectInfo.composition.map((comp) => (
                <span
                  key={comp.language}
                  className="px-2 py-0.5 rounded font-mono text-[10px] bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] text-white"
                >
                  {comp.language} {comp.percentage}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
