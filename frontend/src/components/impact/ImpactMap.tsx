import type { ImpactMap } from '@/types'
import { GitBranch } from 'lucide-react'

interface ImpactMapProps {
  impactMap: ImpactMap
  /** Short display name for the root finding */
  findingTitle: string
}

const CONFIDENCE_COLORS = {
  high:   'text-green-400 border-green-800/50 bg-green-950/30',
  medium: 'text-yellow-400 border-yellow-800/50 bg-yellow-950/30',
  low:    'text-orange-400 border-orange-800/50 bg-orange-950/30',
}

const CONFIDENCE_LABEL = {
  high:   'High — all relationships confirmed via AST',
  medium: 'Medium — some relationships inferred',
  low:    'Low — file-level only',
}

export function ImpactMapViz({ impactMap, findingTitle }: ImpactMapProps) {
  const { callers, callees, affectedFiles, relatedTests, confidence, containingFunction, symbolName, depth } = impactMap
  const hasCallers  = callers.length > 0
  const hasCallees  = callees.length > 0
  const hasTests    = relatedTests.length > 0

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        <GitBranch size={14} className="text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-white">Call Graph</h2>
        <span
          className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded border ${CONFIDENCE_COLORS[confidence]}`}
          title={CONFIDENCE_LABEL[confidence]}
        >
          {confidence} confidence
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Depth / metadata row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Traversal depth: <span className="text-white tabular-nums">{depth}</span></span>
          {containingFunction && (
            <span>Containing function: <span className="font-mono text-white">{containingFunction}</span></span>
          )}
          {symbolName && symbolName !== containingFunction && (
            <span>Symbol: <span className="font-mono text-white">{symbolName}</span></span>
          )}
        </div>

        {/* Visual tree */}
        <div className="space-y-2">

          {/* Callers — what calls INTO the affected code */}
          {hasCallers && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1.5">
                Callers ({callers.length})
              </p>
              <div className="space-y-1 pl-2 border-l-2 border-purple-800/40">
                {callers.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-purple-300 shrink-0">{c.name}</span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 font-mono">
                      {c.file}:{c.line}
                    </span>
                    {c.relationship === 'inferred' && (
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded px-1">inferred</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root finding node */}
          <div className={`rounded-lg border px-3 py-2.5 ${
            containingFunction
              ? 'border-blue-700/60 bg-blue-950/30'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs font-medium text-white truncate">{findingTitle}</span>
              <span className="ml-auto text-[10px] text-blue-400 shrink-0">finding</span>
            </div>
            {(affectedFiles.length > 0 || containingFunction) && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 font-mono truncate">
                {containingFunction ? `in ${containingFunction}` : `${affectedFiles.length} file${affectedFiles.length !== 1 ? 's' : ''} affected`}
              </p>
            )}
          </div>

          {/* Callees — what the affected code calls out TO */}
          {hasCallees && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 mb-1.5">
                Callees ({callees.length})
              </p>
              <div className="space-y-1 pl-2 border-l-2 border-sky-800/40">
                {callees.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-sky-300 shrink-0">{c.name}</span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 font-mono">
                      {c.file}:{c.line}
                    </span>
                    {c.relationship === 'inferred' && (
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded px-1">inferred</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related tests */}
          {hasTests && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mb-1.5">
                Test coverage ({relatedTests.length})
              </p>
              <div className="space-y-1 pl-2 border-l-2 border-green-800/40">
                {relatedTests.map((t, i) => (
                  <span key={i} className="block text-[10px] font-mono text-green-300">{t}</span>
                ))}
              </div>
            </div>
          )}

          {!hasCallers && !hasCallees && !hasTests && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
              No call relationships detected at depth {depth}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
