/**
 * AppLayout — Unified Three-Zone Layout for VECTRA.
 *
 * Mental model:
 *   LEFT / TOP: VECTRA Brand, Target Project Identity, Main Navigation
 *   CENTER:     Primary workflow content
 *   RIGHT:      Engineering Command Center (collapsible, contextual)
 */

import { AppHeader } from './AppHeader'
import type { ProjectReport } from '@/types'

interface AppLayoutProps {
  children: React.ReactNode
  report?: ProjectReport | null
  isAnalyzing?: boolean
  onAnalyze?: () => void
}

export function AppLayout({ children, isAnalyzing = false, onAnalyze }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Top Header */}
      <AppHeader
        isAnalyzing={isAnalyzing}
        onAnalyze={onAnalyze}
      />

      {/* Main Workspace: Full width content */}
      <div className="flex-1 flex w-full relative">
        <main className="flex-1 min-w-0 w-full transition-all duration-200">
          {children}
        </main>
      </div>
    </div>
  )
}

