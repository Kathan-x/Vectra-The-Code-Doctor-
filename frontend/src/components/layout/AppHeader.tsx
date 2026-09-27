import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useActiveProject } from '@/lib/activeProject'
import { VectraLogo, ProjectTargetIcon } from '@/components/brand/VectraLogo'
import { ProjectImportModal } from '@/components/project/ProjectImportModal'
import {
  Activity, GitBranch, Shield, Wrench,
  CheckCircle, FileText, RefreshCw, UploadCloud,
} from 'lucide-react'

interface AppHeaderProps {
  isAnalyzing?: boolean
  onAnalyze?: () => void
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Activity,     path: '/dashboard' },
  { id: 'issues',   label: 'Issues',   icon: Shield,       path: '/issues'    },
  { id: 'impact',   label: 'Impact',   icon: GitBranch,    path: '/impact'    },
  { id: 'repair',   label: 'Repair',   icon: Wrench,       path: '/repair'    },
  { id: 'verify',   label: 'Verify',   icon: CheckCircle,  path: '/verify'    },
  { id: 'report',   label: 'Report',   icon: FileText,     path: '/report'    },
]

export function AppHeader({
  isAnalyzing = false,
  onAnalyze,
}: AppHeaderProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { project } = useActiveProject()
  const [importOpen, setImportOpen] = useState(false)

  const activeId =
    pathname === '/dashboard' || pathname === '/' ? 'overview' :
    pathname.startsWith('/issues')                ? 'issues'   :
    pathname.startsWith('/impact')                ? 'impact'   :
    pathname.startsWith('/repair')                ? 'repair'   :
    pathname.startsWith('/verify')                ? 'verify'   :
    pathname.startsWith('/report')                ? 'report'   :
    'overview'

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.96)] backdrop-blur-md">
        <div className="w-full px-4 sm:px-6">
          {/* Top Bar */}
          <div className="flex h-15 items-center justify-between gap-4">
            {/* Left: VECTRA Brand + Target Project Identity */}
            <div className="flex items-center gap-3.5 min-w-0">
              {/* VECTRA Brand Logo Mark */}
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2.5 shrink-0 group focus:outline-none cursor-pointer"
                aria-label="VECTRA — Go to Overview"
              >
                <VectraLogo size={28} />
                <span className="text-lg font-bold tracking-wider text-white group-hover:text-blue-400 transition-colors" style={{ letterSpacing: '0.08em' }}>
                  VECTRA
                </span>
              </button>

              {/* Vertical Divider */}
              <div className="h-5 w-px bg-[hsl(var(--border))]" />

              {/* Target Project Identity — Distinct from product logo */}
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 min-w-0 px-2 py-1 rounded-lg hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-left group cursor-pointer"
                title="Click to switch or import target project"
              >
                <ProjectTargetIcon size={16} />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[180px] sm:max-w-xs group-hover:text-white transition-colors">
                    Target Project · {project.displayName}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                    project.isImported
                      ? 'border-purple-800/60 bg-purple-950/40 text-purple-300'
                      : 'border-blue-800/60 bg-blue-950/40 text-blue-300'
                  }`}>
                    {project.isImported ? 'Imported' : 'Demo Target'}
                  </span>
                </div>
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="gap-1.5 font-medium text-xs sm:text-sm cursor-pointer"
              >
                <UploadCloud size={14} />
                <span className="hidden sm:inline">Import Project</span>
              </Button>

              {onAnalyze && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onAnalyze}
                  disabled={isAnalyzing}
                  className="gap-1.5 font-medium text-xs sm:text-sm shadow-sm cursor-pointer"
                  aria-label={isAnalyzing ? 'Analyzing…' : 'Run project analysis'}
                >
                  <RefreshCw size={13} className={cn(isAnalyzing && 'animate-spin')} />
                  <span>{isAnalyzing ? 'Analyzing…' : 'Analyze'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-1 h-10 -mb-px overflow-x-auto scrollbar-none" aria-label="Main navigation">
            {NAV_ITEMS.map(({ id, label, icon: Icon, path }) => {
              const isActive = activeId === id
              return (
                <button
                  key={id}
                  onClick={() => navigate(path)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 h-full text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 rounded-t-md whitespace-nowrap cursor-pointer',
                    isActive
                      ? 'border-blue-500 text-white font-semibold bg-blue-950/20'
                      : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-white hover:border-[hsl(var(--border))]'
                  )}
                >
                  <Icon size={14} aria-hidden="true" className={isActive ? 'text-blue-400' : ''} />
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Project Import Modal */}
      <ProjectImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onProjectImported={() => {
          setImportOpen(false)
          if (onAnalyze) onAnalyze()
          else navigate('/dashboard')
        }}
      />
    </>
  )
}
