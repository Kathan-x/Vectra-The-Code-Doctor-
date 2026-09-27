import type { ImpactMap } from '@/types'
import { Files } from 'lucide-react'

interface AffectedFilesProps {
  impactMap: ImpactMap
}

export function AffectedFiles({ impactMap }: AffectedFilesProps) {
  const { affectedFiles, callers, callees } = impactMap

  const callersByFile = new Map<string, typeof callers>()
  for (const c of callers) {
    const rel = c.file
    if (!callersByFile.has(rel)) callersByFile.set(rel, [])
    callersByFile.get(rel)!.push(c)
  }
  const calleesByFile = new Map<string, typeof callees>()
  for (const c of callees) {
    const rel = c.file
    if (!calleesByFile.has(rel)) calleesByFile.set(rel, [])
    calleesByFile.get(rel)!.push(c)
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <Files size={14} className="text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-white">Affected Files</h2>
        <span className="ml-auto text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {affectedFiles.length} file{affectedFiles.length !== 1 ? 's' : ''}
        </span>
      </div>

      {affectedFiles.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No additional affected files detected.</p>
        </div>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {affectedFiles.map(file => {
            const fileCallers = callersByFile.get(file) ?? []
            const fileCallees = calleesByFile.get(file) ?? []
            const symbols = [...fileCallers, ...fileCallees]
            return (
              <div key={file} className="px-4 py-3">
                <p className="text-xs font-mono text-white break-all">{file}</p>
                {symbols.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {fileCallers.map((c, i) => (
                      <span
                        key={`caller-${i}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300"
                        title={`caller — line ${c.line}`}
                      >
                        ↑ {c.name}
                        <span className="opacity-50 ml-1">:{c.line}</span>
                      </span>
                    ))}
                    {fileCallees.map((c, i) => (
                      <span
                        key={`callee-${i}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-800/40 text-sky-300"
                        title={`callee — line ${c.line}`}
                      >
                        ↓ {c.name}
                        <span className="opacity-50 ml-1">:{c.line}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
