import type { AnalysisSnapshot, BeforeAfterDelta } from '@/types'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react'

interface VerificationResultProps {
  before: AnalysisSnapshot
  after: AnalysisSnapshot | null
  issueId: string
  stage: string
  delta?: BeforeAfterDelta | null
  findingFingerprint?: string | null
}

function Delta({ before: b, after: a, label, lowerIsBetter = false }: {
  before: number; after: number | null; label: string; lowerIsBetter?: boolean
}) {
  if (a === null) return null
  const diff = a - b
  const improved = lowerIsBetter ? diff < 0 : diff > 0
  const neutral  = diff === 0
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] px-3 py-2">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-sm font-semibold tabular-nums text-white">{a}</span>
        {neutral ? (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-0.5 mb-0.5">
            <Minus size={9} /> unchanged
          </span>
        ) : improved ? (
          <span className="text-[10px] text-green-400 flex items-center gap-0.5 mb-0.5">
            <TrendingUp size={9} /> {diff > 0 ? '+' : ''}{diff} vs before
          </span>
        ) : (
          <span className="text-[10px] text-red-400 flex items-center gap-0.5 mb-0.5">
            <TrendingDown size={9} /> {diff} vs before
          </span>
        )}
      </div>
    </div>
  )
}

export function VerificationResult({ before, after, issueId, stage, delta: propDelta, findingFingerprint }: VerificationResultProps) {
  const isVerifying = stage === 'verifying'
  const noData      = !after

  const beforeFail  = before.testResults.failed
  const afterFail   = after?.testResults.failed ?? null
  const afterPass   = after?.testResults.passed ?? null
  const beforeFinds = before.findings.length
  const afterFinds  = after?.findings.length ?? null

  // Strict 1-to-1 bipartite correlation to prevent contradictory resolved / introduced findings
  const delta = after ? (() => {
    const matchedAfterIndices = new Set<number>()
    const remainingFindingIds: string[] = []
    const resolvedFindingIds: string[] = []

    const normPath = (p: string) => p.replace(/\\/g, '/').toLowerCase()

    for (const bf of before.findings) {
      let bestMatchIndex = -1
      let highestScore = -1

      for (let i = 0; i < after.findings.length; i++) {
        if (matchedAfterIndices.has(i)) continue
        const af = after.findings[i]

        if (normPath(af.file) !== normPath(bf.file)) continue
        if (af.ruleId !== bf.ruleId) continue

        let score = 0
        if (af.id === bf.id) score += 100
        if (af.evidence && bf.evidence && af.evidence.trim() === bf.evidence.trim()) score += 60
        if (af.title && bf.title && af.title.trim() === bf.title.trim()) score += 30
        const lineDist = Math.abs(af.line - bf.line)
        score += Math.max(0, 20 - lineDist * 0.5)

        if (score > highestScore && score >= 40) {
          highestScore = score
          bestMatchIndex = i
        }
      }

      if (bestMatchIndex !== -1) {
        matchedAfterIndices.add(bestMatchIndex)
        remainingFindingIds.push(bf.id)
      } else {
        resolvedFindingIds.push(bf.id)
      }
    }

    const newFindingIds: string[] = []
    for (let i = 0; i < after.findings.length; i++) {
      if (!matchedAfterIndices.has(i)) {
        newFindingIds.push(after.findings[i].id)
      }
    }

    return {
      resolved: resolvedFindingIds,
      remaining: remainingFindingIds,
      introduced: newFindingIds,
    }
  })() : null

  const issueResolved = stage === 'verified'
    ? true
    : (propDelta?.resolvedFindingIds?.includes(issueId) ?? false) ||
      (findingFingerprint ? (propDelta?.resolvedFingerprints?.includes(findingFingerprint) ?? false) : false) ||
      (delta?.resolved.includes(issueId) ?? false)

  const resolved = propDelta?.resolvedFindingIds && propDelta.resolvedFindingIds.length > 0
    ? propDelta.resolvedFindingIds
    : delta?.resolved ?? []

  const introduced = propDelta?.newFindingIds && propDelta.newFindingIds.length > 0
    ? propDelta.newFindingIds
    : delta?.introduced ?? []

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
        {isVerifying ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        ) : issueResolved ? (
          <CheckCircle2 size={14} className="text-green-400" />
        ) : noData ? (
          <Minus size={14} className="text-[hsl(var(--muted-foreground))]" />
        ) : (
          <XCircle size={14} className="text-red-400" />
        )}
        <h2 className="text-sm font-semibold text-white">Verification</h2>
        {!noData && !isVerifying && (
          <span className={`ml-auto text-xs font-medium ${issueResolved ? 'text-green-400' : 'text-red-400'}`}>
            {issueResolved ? 'Issue resolved' : 'Issue persists'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {isVerifying && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Re-analyzing project with VECTRA tools…</p>
        )}

        {noData && !isVerifying && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Before/after comparison unavailable until verification completes.
          </p>
        )}

        {after && (
          <>
            {/* Issue resolution status */}
            <div className={`rounded-lg border px-3 py-2.5 ${
              issueResolved
                ? 'border-green-800/50 bg-green-950/20'
                : 'border-red-800/50 bg-red-950/20'
            }`}>
              <p className={`text-xs font-medium ${issueResolved ? 'text-green-400' : 'text-red-400'}`}>
                {issueResolved
                  ? '✓ Original issue no longer detected by static analysis.'
                  : '✗ Original issue still detected. Manual review recommended.'}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <Delta before={before.testResults.passed} after={afterPass}    label="Tests passing" />
              <Delta before={beforeFail}                after={afterFail}    label="Tests failing"  lowerIsBetter />
              <Delta before={beforeFinds}               after={afterFinds}   label="Total findings" lowerIsBetter />
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] px-3 py-2">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">Pass rate</p>
                <p className="text-sm font-semibold tabular-nums text-white">
                  {after.testResults.total > 0
                    ? Math.round((after.testResults.passed / after.testResults.total) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            {/* Resolved / introduced findings */}
            {resolved.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mb-1.5">
                  Resolved findings ({resolved.length})
                </p>
                <div className="space-y-1">
                  {resolved.map(id => {
                    const f = before.findings.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center gap-2 text-[11px] text-green-300">
                        <CheckCircle2 size={10} className="shrink-0" />
                        <span className="font-mono truncate">{f?.title ?? id}</span>
                        {f && <Badge variant={f.severity} className="uppercase text-[9px] shrink-0">{f.severity.slice(0,4)}</Badge>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {introduced.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1.5">
                  Newly introduced ({introduced.length})
                </p>
                <div className="space-y-1">
                  {introduced.map(id => {
                    const f = after.findings.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center gap-2 text-[11px] text-red-300">
                        <XCircle size={10} className="shrink-0" />
                        <span className="font-mono truncate">{f?.title ?? id}</span>
                        {f && <Badge variant={f.severity} className="uppercase text-[9px] shrink-0">{f.severity.slice(0,4)}</Badge>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
