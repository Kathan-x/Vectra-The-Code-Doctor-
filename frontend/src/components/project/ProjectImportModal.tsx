/**
 * ProjectImportModal — Upload, Intelligent Extraction, Auto-Discovery & Auto-Analysis.
 *
 * Requirements:
 * - Robust handling for large archives (e.g. 194MB CP Project).
 * - Real multi-step progression:
 *     1. Uploading
 *     2. Extracting
 *     3. Discovering
 *     4. Analyzing
 *     5. Ready
 * - AUTOMATIC ANALYSIS AFTER IMPORT:
 *     The user does NOT need to click "Analyze" again. Once extracted, analysis
 *     starts automatically and routes directly to Overview when complete.
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useActiveProject, type ActiveProject } from '@/lib/activeProject'
import { logActivity } from '@/lib/activityStore'
import { Button } from '@/components/ui/button'
import {
  UploadCloud, FileArchive, CheckCircle2, AlertTriangle,
  X, Loader2, ArrowRight, RotateCcw, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectImportModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectImported?: (project: ActiveProject) => void
}

type ImportPhase = 'select' | 'uploading' | 'extracting' | 'discovering' | 'analyzing' | 'success' | 'error'

const PROGRESS_STEPS: Array<{ key: ImportPhase; label: string; desc: string }> = [
  { key: 'uploading',   label: 'Uploading',   desc: 'Streaming archive to secure workspace' },
  { key: 'extracting',  label: 'Extracting',  desc: 'Unpacking files & excluding generated artifacts' },
  { key: 'discovering', label: 'Discovering', desc: 'Detecting framework, language, & test suites' },
  { key: 'analyzing',   label: 'Analyzing',   desc: 'Running deterministic AST scan & test runner' },
  { key: 'success',     label: 'Ready',       desc: 'Active target configured and analysis complete' },
]

export function ProjectImportModal({ isOpen, onClose, onProjectImported }: ProjectImportModalProps) {
  const navigate = useNavigate()
  const { project, setProject, resetToDefault } = useActiveProject()

  const [phase, setPhase] = useState<ImportPhase>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [importedProject, setImportedProject] = useState<ActiveProject | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setPhase('select')
    setSelectedFile(null)
    setUploadPercent(null)
    setImportedProject(null)
    setErrorMessage(null)
    setIsDragging(false)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  if (!isOpen) return null

  const handleFileChosen = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid .zip archive file.')
      setPhase('error')
      return
    }
    setSelectedFile(file)
    setErrorMessage(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChosen(e.dataTransfer.files[0])
    }
  }

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return
    setErrorMessage(null)
    setPhase('uploading')
    setUploadPercent(0)

    try {
      // 1. Uploading
      const res = await api.importProject(selectedFile, (pct) => {
        setUploadPercent(pct)
        if (pct >= 100) {
          setPhase('extracting')
        }
      })

      // 2. Extracting & Discovering
      setPhase('discovering')

      const newProj: ActiveProject = {
        path: res.path,
        displayName: res.displayName,
        typeLabel: res.typeLabel,
        isImported: true,
        projectId: res.projectId,
      }

      setImportedProject(newProj)
      setProject(newProj)

      logActivity({
        type: 'project_imported',
        title: `Target Project Imported: ${newProj.displayName}`,
        description: `Imported archive "${selectedFile.name}" (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB) · ${newProj.typeLabel}`,
        projectName: newProj.displayName,
      })

      // 3. Automatic Analysis (User does NOT need to click Analyze again!)
      setPhase('analyzing')

      const analyzeRes = await api.analyze(newProj.path, true)
      await api.generateReport(newProj.path).catch(() => {
        // non-fatal if report generation succeeds on demand
      })

      logActivity({
        type: 'analysis_completed',
        title: `Analysis Completed: ${newProj.displayName}`,
        description: `Identified ${analyzeRes.snapshot.findings.length} findings and evaluated ${analyzeRes.snapshot.testResults.total} tests.`,
        projectName: newProj.displayName,
      })

      setPhase('success')

      // Short delay for the user to see the success state, then close & route to Dashboard
      setTimeout(() => {
        onProjectImported?.(newProj)
        handleClose()
        navigate('/dashboard')
      }, 1200)

    } catch (err) {
      console.error('Import or analysis error:', err)
      setErrorMessage((err as Error).message || 'Failed to process project archive.')
      setPhase('error')
    }
  }

  const handleSwitchToDemo = () => {
    resetToDefault()
    logActivity({
      type: 'project_imported',
      title: 'Switched Target to VECTRA Demo Service',
      description: 'Active analysis target reset to built-in Express demo service.',
      projectName: 'VECTRA Demo Service',
    })
    handleClose()
    navigate('/dashboard')
  }

  const isBusy = phase === 'uploading' || phase === 'extracting' || phase === 'discovering' || phase === 'analyzing'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <UploadCloud size={18} />
            </div>
            <div>
              <h2 id="import-modal-title" className="text-base font-bold text-white tracking-tight">
                Import Target Project
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Upload a ZIP archive to analyze your application
              </p>
            </div>
          </div>
          {!isBusy && (
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-white hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* STEP 1: Select Archive */}
          {phase === 'select' && (
            <div className="space-y-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChosen(e.target.files[0])
                  }
                }}
              />

              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer',
                  isDragging
                    ? 'border-blue-500 bg-blue-950/20'
                    : selectedFile
                    ? 'border-blue-500/60 bg-blue-950/10'
                    : 'border-[hsl(var(--border))] hover:border-blue-500/50 bg-[hsl(var(--muted)/0.2)]'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-blue-400 mb-3">
                  <FileArchive size={24} />
                </div>
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready for upload
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-white mb-1">
                      Click to choose archive or drag &amp; drop
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Supported: .zip archives up to 600 MB (Node.js, Express, TypeScript, etc.)
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                {project.isImported ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwitchToDemo}
                    className="gap-2 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    Reset to Demo Service
                  </Button>
                ) : (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Default target: VECTRA Demo Service
                  </span>
                )}

                <Button
                  variant="default"
                  size="md"
                  onClick={handleUploadAndAnalyze}
                  disabled={!selectedFile}
                  className="gap-2 ml-auto cursor-pointer"
                >
                  <span>Upload &amp; Analyze</span>
                  <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Progress (Uploading, Extracting, Discovering, Analyzing) */}
          {isBusy && (
            <div className="py-4 space-y-6">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 size={36} className="text-blue-500 animate-spin" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {phase === 'uploading'   && (uploadPercent !== null && uploadPercent < 100 ? `Uploading Archive (${uploadPercent}%)…` : 'Uploading Archive…')}
                    {phase === 'extracting'  && 'Extracting Project Archive…'}
                    {phase === 'discovering' && 'Discovering Architecture…'}
                    {phase === 'analyzing'   && 'Running Automated Analysis…'}
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-sm">
                    {phase === 'uploading'   && 'Streaming archive into VECTRA workspace securely.'}
                    {phase === 'extracting'  && 'Unpacking source files and skipping generated cache folders.'}
                    {phase === 'discovering' && 'Detecting package structure, dependencies, and test suites.'}
                    {phase === 'analyzing'   && 'Scanning AST, checking security rules, and validating tests.'}
                  </p>
                </div>
              </div>

              {/* Progress Steps List */}
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] p-4 space-y-3">
                {PROGRESS_STEPS.map((s, idx) => {
                  const phaseOrder: ImportPhase[] = ['uploading', 'extracting', 'discovering', 'analyzing', 'success']
                  const currentIdx = phaseOrder.indexOf(phase)
                  const stepIdx = phaseOrder.indexOf(s.key)
                  const isDone = currentIdx > stepIdx
                  const isCurrent = currentIdx === stepIdx

                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold shrink-0',
                        isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        isCurrent ? 'bg-blue-600 text-white animate-pulse' :
                        'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]'
                      )}>
                        {isDone ? <Check size={13} /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn(
                            'text-xs font-semibold',
                            isDone ? 'text-emerald-300' : isCurrent ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'
                          )}>
                            {s.label}
                          </p>
                          {isCurrent && phase === 'uploading' && uploadPercent !== null && (
                            <span className="text-[11px] font-mono text-blue-400 tabular-nums">
                              {uploadPercent}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {phase === 'success' && importedProject && (
            <div className="py-4 space-y-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Target Project Ready</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                  Analysis complete. Redirecting to Overview…
                </p>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] p-4 text-left space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[hsl(var(--muted-foreground))]">
                    Target Project
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                    Active
                  </span>
                </div>
                <p className="text-sm font-bold text-white">{importedProject.displayName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{importedProject.typeLabel}</p>
              </div>
            </div>
          )}

          {/* STEP 4: Error */}
          {phase === 'error' && (
            <div className="space-y-5">
              <div className="flex items-start gap-4 rounded-xl border border-red-800/40 bg-red-950/20 p-5">
                <AlertTriangle size={24} className="text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Import Failed</p>
                  <p className="text-xs text-red-200 leading-relaxed">
                    {errorMessage ?? 'An error occurred while importing or analyzing the archive.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button variant="ghost" size="sm" onClick={resetState} className="cursor-pointer">
                  Back
                </Button>
                <Button variant="default" size="sm" onClick={resetState} className="gap-2 cursor-pointer">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
