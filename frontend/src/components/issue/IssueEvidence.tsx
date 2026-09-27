import type { Finding } from '@/types'
import { AlertCircle, Code2, Terminal } from 'lucide-react'

interface IssueEvidenceProps {
  finding: Finding
  relatedTests?: string[]
}

export function IssueEvidence({ finding }: IssueEvidenceProps) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)]">
        <Code2 size={18} className="text-blue-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-0.5 rounded">
          2. Evidence
        </span>
        <h2 className="text-base font-bold text-white">Detection Point &amp; Source Code</h2>
      </div>

      <div className="p-6 space-y-5">
        {/* Source at detection point */}
        {finding.evidence ? (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
              <span className="flex items-center gap-1.5">
                <Terminal size={13} />
                Source Snippet
              </span>
              <span className="font-mono text-[hsl(var(--muted-foreground))]">
                {finding.file}:{finding.line ?? 1}
              </span>
            </div>

            <div className="relative rounded-xl bg-[hsl(var(--muted)/0.7)] border border-[hsl(var(--border))] overflow-hidden">
              <div className="flex overflow-x-auto">
                {/* Line number gutter */}
                <div className="shrink-0 px-4 py-3.5 text-right select-none border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <span className="text-sm font-mono font-bold text-blue-400">
                    {finding.line ?? 1}
                  </span>
                </div>
                {/* Code body */}
                <pre className="flex-1 px-5 py-3.5 text-sm font-mono text-amber-200 leading-relaxed whitespace-pre-wrap break-all">
                  {finding.evidence}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        {/* Detector explanation */}
        <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Detector Explanation
            </p>
            <p className="text-sm text-white leading-relaxed">
              {finding.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
