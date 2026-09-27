// Frontend mirror of backend/src/types/index.ts
// Keep in sync manually — do not add frontend-only types here

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type FindingCategory = 'security' | 'bug' | 'async' | 'quality' | 'test'

export interface Finding {
  id: string
  category: FindingCategory
  severity: Severity
  title: string
  description: string
  file: string
  line: number
  column?: number
  ruleId?: string
  evidence?: string
}

export interface TestResult {
  name: string
  file: string
  status: 'passed' | 'failed' | 'skipped'
  duration?: number
  errorMessage?: string
}

export interface TestSuiteResult {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  tests: TestResult[]
  rawOutput: string
  commandUsed?: string
  workingDirectory?: string
  analysisRoot?: string
  testWorkingDirectory?: string
  executionStatus?: 'passed' | 'failed' | 'unable_to_execute' | 'no_tests_found' | 'not_run'
  statusMessage?: string
}

export interface ProjectScopeMetrics {
  totalFiles: number
  analyzedFiles: number
  testFiles: number
  excludedFiles: number
}

export interface LanguageCompositionItem {
  language: string
  fileCount: number
  percentage: number
  analyzed: boolean
}

export interface SubprojectInfo {
  name: string
  path: string
  type: string
  framework?: string
}

export interface ProjectInfo {
  path: string
  name: string
  language: 'javascript' | 'typescript' | 'mixed' | 'unknown'
  framework?: string
  fileCount: number
  sourceFiles: string[]
  testFiles: string[]
  packageJson?: Record<string, unknown>
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'unknown'
  sourceDirs?: string[]
  testDirs?: string[]
  scope: ProjectScopeMetrics
  composition: LanguageCompositionItem[]
  subprojects?: SubprojectInfo[]
}

export interface PrioritizedIssue {
  id: string
  finding: Finding
  score: number
  blastRadius: number
  hasFailingTest: boolean
  relatedTests: string[]
}

export interface ImpactMap {
  issueId: string
  symbolName?: string
  containingFunction?: string
  affectedFiles: string[]
  callers: Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }>
  callees: Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }>
  relatedTests: string[]
  depth: number
  confidence: 'high' | 'medium' | 'low'
}

export interface RepairPlan {
  issueId: string
  summary: string
  steps: Array<{
    order: number
    file: string
    description: string
    type: 'edit' | 'add' | 'delete' | 'rename'
  }>
  estimatedRisk: 'low' | 'medium' | 'high'
  rawBobResponse: string
}

export interface ReviewResult {
  issueId: string
  status: 'approved' | 'concerns' | 'blocked'
  summary: string
  concerns: Array<{
    severity: Severity
    description: string
    file?: string
    line?: number
  }>
  rawBobResponse: string
  changedFiles?: string[]
  syntaxValid?: boolean
  securityRegression?: boolean
  timestamp?: string
}

export type RepairWorkflowStage =
  | 'idle'
  | 'plan_ready'
  | 'repair_applied'
  | 'review_pending'
  | 'review_running'
  | 'review_passed'
  | 'review_failed'
  | 'verification_pending'
  | 'verification_running'
  | 'verification_passed'
  | 'verification_partial'
  | 'verification_failed'

export interface AnalysisSnapshot {
  timestamp: string
  projectInfo: ProjectInfo
  findings: Finding[]
  prioritizedIssues: PrioritizedIssue[]
  testResults: TestSuiteResult
}

export interface EngineeringReport {
  id: string
  issueId: string
  createdAt: string
  before: AnalysisSnapshot
  after: AnalysisSnapshot
  repairPlan: RepairPlan
  reviewResult: ReviewResult
  delta: {
    testsPassing: { before: number; after: number }
    testsFailing: { before: number; after: number }
    findingsTotal: { before: number; after: number }
    resolvedFindingIds: string[]
    newFindingIds: string[]
  }
}

export interface AnalyzeResponse {
  cacheKey: string
  cached: boolean
  snapshot: AnalysisSnapshot
}

// ── Project-level report types ────────────────────────────────────────

export type ReportStatus =
  | 'NOT_ANALYZED'
  | 'ISSUES_FOUND'
  | 'REPAIR_IN_PROGRESS'
  | 'READY_FOR_VERIFICATION'
  | 'VERIFIED'
  | 'VERIFICATION_FAILED'

export interface SeverityDistribution {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface CategoryDistribution {
  security: number
  bug: number
  async: number
  quality: number
  test: number
}

export type VerificationReason =
  | 'all_checks_passed'
  | 'tests_improved_issues_remain'
  | 'failing_tests'
  | 'issue_persists'
  | 'review_concern'
  | 'analysis_failed'

export interface ReportSummary {
  totalFindings: number
  severity: SeverityDistribution
  categories: CategoryDistribution
  totalTests: number
  passingTests: number
  failingTests: number
  affectedFiles: number
  repairedIssues: number
  verificationStatus: 'not_run' | 'passed' | 'failed' | 'partial'
  verificationReason?: VerificationReason
}

export interface RepairRecord {
  issueId: string
  findingTitle: string
  findingFile: string
  findingLine: number
  findingFingerprint?: string
  plan: RepairPlan | null
  reviewResult: ReviewResult | null
  appliedAt: string | null
  beforeSnapshots?: Record<string, string>
  beforeHashes?: Record<string, string>
  afterHashes?: Record<string, string>
  modifiedFiles?: string[]
  workflowStage?: RepairWorkflowStage
  diff?: string
}

export interface BeforeAfterDelta {
  findingsBefore: number
  findingsAfter: number | null
  resolvedFindingIds: string[]
  newFindingIds: string[]
  remainingFindingIds: string[]
  resolvedFingerprints?: string[]
  newFingerprints?: string[]
  remainingFingerprints?: string[]
  testPassingBefore: number
  testPassingAfter: number | null
  testFailingBefore: number
  testFailingAfter: number | null
}

export interface ProjectReport {
  id: string
  projectPath: string
  projectName: string
  createdAt: string
  status: ReportStatus
  summary: ReportSummary
  snapshot: AnalysisSnapshot
  repairs: RepairRecord[]
  delta: BeforeAfterDelta | null
  afterSnapshot: AnalysisSnapshot | null
}
