/**
 * VECTRA Report Engine
 *
 * Aggregates analysis, impact, repair, review, and verification data
 * into a structured ProjectReport. All values derive from real data —
 * nothing is invented or hardcoded.
 *
 * Status derivation (deterministic):
 *   NOT_ANALYZED         — no cache exists
 *   ISSUES_FOUND         — cache exists, findings > 0, no repairs run
 *   REPAIR_IN_PROGRESS   — at least one repair record with plan but no review
 *   READY_FOR_VERIFICATION — repair + review done, no re-analysis yet
 *   VERIFIED             — re-analysis run and all originally-failing tests now pass
 *   VERIFICATION_FAILED  — re-analysis run but still has failing tests
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AnalysisSnapshot,
  ProjectReport,
  ReportStatus,
  ReportSummary,
  SeverityDistribution,
  CategoryDistribution,
  RepairRecord,
  BeforeAfterDelta,
  Finding,
  Severity,
  FindingCategory,
  VerificationReason,
} from '../types';
import { nanoid } from '../utils/nanoid';
import { getFindingFingerprint, areFindingsEqual, normalizeFilePath, normalizeText } from '../analysis/fingerprint';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── Summary computation ────────────────────────────────────────────────

function computeSeverityDist(findings: Finding[]): SeverityDistribution {
  const dist: SeverityDistribution = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    dist[f.severity as Severity] = (dist[f.severity as Severity] ?? 0) + 1;
  }
  return dist;
}

function computeCategoryDist(findings: Finding[]): CategoryDistribution {
  const dist: CategoryDistribution = { security: 0, bug: 0, async: 0, quality: 0, test: 0 };
  for (const f of findings) {
    dist[f.category as FindingCategory] = (dist[f.category as FindingCategory] ?? 0) + 1;
  }
  return dist;
}

function computeAffectedFiles(findings: Finding[]): number {
  return new Set(findings.map(f => f.file)).size;
}

export function computeVerificationEvaluation(
  snapshot: AnalysisSnapshot,
  afterSnapshot: AnalysisSnapshot | null,
  repairs: RepairRecord[] = [],
  delta?: BeforeAfterDelta | null,
): { status: ReportSummary['verificationStatus']; reason?: VerificationReason } {
  if (!afterSnapshot) return { status: 'not_run' };

  const beforeFail = snapshot.testResults.failed;
  const afterFail = afterSnapshot.testResults.failed;
  const beforeFinds = snapshot.findings.length;
  const afterFinds = afterSnapshot.findings.length;

  const appliedRepairs = repairs.filter(r => r.plan !== null && r.appliedAt !== null);
  const resolvedIds = new Set(delta?.resolvedFindingIds ?? []);
  const resolvedFps = new Set(delta?.resolvedFingerprints ?? []);
  const remainingFps = new Set(delta?.remainingFingerprints ?? []);

  function isRepairResolved(r: RepairRecord): boolean {
    if (resolvedIds.has(r.issueId)) return true;
    if (r.findingFingerprint && resolvedFps.has(r.findingFingerprint)) return true;
    if (r.findingFingerprint && !remainingFps.has(r.findingFingerprint)) return true;
    // Check if matching baseline finding was resolved
    const matchedBf = snapshot.findings.find(
      bf => bf.id === r.issueId ||
            (r.findingFingerprint && getFindingFingerprint(bf) === r.findingFingerprint) ||
            (normalizeFilePath(bf.file) === normalizeFilePath(r.findingFile) && normalizeText(bf.title) === normalizeText(r.findingTitle))
    );
    if (matchedBf && resolvedIds.has(matchedBf.id)) return true;
    return false;
  }

  const targetIssuesResolved = appliedRepairs.length > 0
    ? appliedRepairs.every(isRepairResolved)
    : (afterFinds < beforeFinds || beforeFinds === 0);

  const someTargetIssuesResolved = appliedRepairs.length > 0
    ? appliedRepairs.some(isRepairResolved)
    : (afterFinds < beforeFinds);

  // Check if any review flagged concerns or was blocked
  const hasReviewConcerns = appliedRepairs.some(
    r => r.reviewResult?.status === 'concerns' || r.reviewResult?.status === 'blocked'
  );

  // 1. Are there failing tests in the afterSnapshot?
  if (afterFail > 0) {
    if (afterFail < beforeFail || (someTargetIssuesResolved && afterFail <= beforeFail)) {
      return { status: 'partial', reason: 'tests_improved_issues_remain' };
    }
    return { status: 'failed', reason: 'failing_tests' };
  }

  // 2. Here: afterFail === 0 (ALL TESTS PASS!)
  if (targetIssuesResolved && (afterFinds < beforeFinds || beforeFinds === 0)) {
    if (hasReviewConcerns) {
      return { status: 'partial', reason: 'review_concern' };
    }
    return { status: 'passed', reason: 'all_checks_passed' };
  }

  // 3. If applied repairs were not resolved:
  if (appliedRepairs.length > 0 && !targetIssuesResolved) {
    if (someTargetIssuesResolved) {
      return { status: 'partial', reason: 'tests_improved_issues_remain' };
    }
    return { status: 'failed', reason: 'issue_persists' };
  }

  if (someTargetIssuesResolved || afterFinds < beforeFinds) {
    return { status: 'partial', reason: 'tests_improved_issues_remain' };
  }

  // Target issue persists despite tests passing cleanly
  return { status: 'failed', reason: 'issue_persists' };
}

export function computeSummary(
  snapshot: AnalysisSnapshot,
  repairs: RepairRecord[],
  afterSnapshot: AnalysisSnapshot | null,
  delta?: BeforeAfterDelta | null,
): ReportSummary {
  const currentSnapshot = afterSnapshot ?? snapshot;
  const findings = currentSnapshot.findings;
  const evaluation = computeVerificationEvaluation(snapshot, afterSnapshot, repairs, delta);
  return {
    totalFindings: findings.length,
    severity: computeSeverityDist(findings),
    categories: computeCategoryDist(findings),
    totalTests: currentSnapshot.testResults.total,
    passingTests: currentSnapshot.testResults.passed,
    failingTests: currentSnapshot.testResults.failed,
    affectedFiles: computeAffectedFiles(findings),
    repairedIssues: repairs.filter(r => r.plan !== null && r.appliedAt !== null).length,
    verificationStatus: evaluation.status,
    verificationReason: evaluation.reason,
  };
}

// ── Status derivation ──────────────────────────────────────────────────

export function deriveStatus(
  snapshot: AnalysisSnapshot | null,
  repairs: RepairRecord[],
  afterSnapshot: AnalysisSnapshot | null,
  verificationEvaluation?: { status: ReportSummary['verificationStatus']; reason?: VerificationReason },
): ReportStatus {
  if (!snapshot) return 'NOT_ANALYZED';

  const hasAppliedRepairs = repairs.some(r => r.plan !== null && r.appliedAt !== null);

  // If verification was run with an afterSnapshot, derive status from verified results
  if (hasAppliedRepairs && afterSnapshot) {
    if (verificationEvaluation?.status === 'passed') {
      return 'VERIFIED';
    }
    return 'VERIFICATION_FAILED';
  }

  if (!hasAppliedRepairs) {
    return snapshot.findings.length === 0 ? 'VERIFIED' : 'ISSUES_FOUND';
  }

  const allReviewed = repairs.every(r => r.plan === null || r.reviewResult !== null);
  if (allReviewed) return 'READY_FOR_VERIFICATION';

  return 'REPAIR_IN_PROGRESS';
}

// ── Delta computation ──────────────────────────────────────────────────

export function computeDelta(
  before: AnalysisSnapshot,
  after: AnalysisSnapshot,
): BeforeAfterDelta {
  // Track matched findings from 'after' to guarantee strict 1-to-1 correspondence
  const matchedAfterIndices = new Set<number>();
  const remainingFindingIds: string[] = [];
  const remainingFingerprints: string[] = [];
  const resolvedFindingIds: string[] = [];
  const resolvedFingerprints: string[] = [];

  // For every finding in before, find its single best match in after
  for (const bf of before.findings) {
    const bfFp = getFindingFingerprint(bf);
    let bestMatchIndex = -1;
    let highestScore = -1;

    for (let i = 0; i < after.findings.length; i++) {
      if (matchedAfterIndices.has(i)) continue;
      const af = after.findings[i];
      const afFp = getFindingFingerprint(af);

      // Must be same file
      if (normalizeFilePath(af.file) !== normalizeFilePath(bf.file)) continue;

      let score = 0;
      // 1. Direct fingerprint match (same rule, same file, same title)
      if (afFp === bfFp) {
        score += 100;
      }
      // 2. Identical ID (exact position and metadata unchanged)
      if (af.id === bf.id) {
        score += 80;
      }
      // 3. Exact evidence match (the code that caused the defect is identical)
      if (af.evidence && bf.evidence && normalizeText(af.evidence) === normalizeText(bf.evidence)) {
        score += 60;
      }
      // 4. Exact title / message match
      if (af.title && bf.title && normalizeText(af.title) === normalizeText(bf.title)) {
        score += 30;
      }
      // 5. Line distance: prefer closer lines
      const lineDist = Math.abs(af.line - bf.line);
      score += Math.max(0, 20 - lineDist * 0.5);

      // Threshold of 40 ensures high-confidence match
      if (score > highestScore && score >= 40) {
        highestScore = score;
        bestMatchIndex = i;
      }
    }

    if (bestMatchIndex !== -1) {
      // Finding still exists in 'after' (persisting)
      matchedAfterIndices.add(bestMatchIndex);
      remainingFindingIds.push(bf.id);
      remainingFingerprints.push(bfFp);
    } else {
      // Finding was resolved!
      resolvedFindingIds.push(bf.id);
      resolvedFingerprints.push(bfFp);
    }
  }

  // Any finding in 'after' that was NOT matched to any 'before' finding is newly introduced
  const newFindingIds: string[] = [];
  const newFingerprints: string[] = [];
  for (let i = 0; i < after.findings.length; i++) {
    if (!matchedAfterIndices.has(i)) {
      newFindingIds.push(after.findings[i].id);
      newFingerprints.push(getFindingFingerprint(after.findings[i]));
    }
  }

  return {
    findingsBefore: before.findings.length,
    findingsAfter: after.findings.length,
    resolvedFindingIds,
    resolvedFingerprints,
    newFindingIds,
    newFingerprints,
    remainingFindingIds,
    remainingFingerprints,
    testPassingBefore: before.testResults.passed,
    testPassingAfter: after.testResults.passed,
    testFailingBefore: before.testResults.failed,
    testFailingAfter: after.testResults.failed,
  };
}

// ── Persistence ────────────────────────────────────────────────────────

function reportFilePath(projectPath: string): string {
  const key = crypto.createHash('md5').update(path.resolve(projectPath)).digest('hex');
  return path.join(REPORTS_DIR, `${key}.json`);
}

export function loadReport(projectPath: string): ProjectReport | null {
  ensureDirs();
  const file = reportFilePath(projectPath);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ProjectReport;
  } catch {
    return null;
  }
}

export function saveReport(report: ProjectReport): void {
  ensureDirs();
  const file = reportFilePath(report.projectPath);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf-8');
}

// ── Main generator ─────────────────────────────────────────────────────

export interface GenerateReportOptions {
  snapshot: AnalysisSnapshot;
  projectPath: string;
  /** Pass existing repairs from a prior save to preserve repair history */
  existingRepairs?: RepairRecord[];
  /** Pass a new repair record to add/update */
  newRepair?: RepairRecord;
  /** The after-repair re-analysis snapshot */
  afterSnapshot?: AnalysisSnapshot | null;
}

export function generateReport(opts: GenerateReportOptions): ProjectReport {
  const { snapshot, projectPath, existingRepairs = [], newRepair, afterSnapshot } = opts;

  // Load existing report to preserve report id, prior repairs, and afterSnapshot
  const existing = loadReport(projectPath);

  // Merge repairs: update existing record if same issueId, otherwise append
  let repairs = existingRepairs.length > 0 ? [...existingRepairs] : (existing?.repairs ? [...existing.repairs] : []);
  if (newRepair) {
    const idx = repairs.findIndex(r => r.issueId === newRepair.issueId);
    if (idx >= 0) repairs[idx] = newRepair;
    else repairs.push(newRepair);
  }

  // Only permit afterSnapshot and delta if at least one repair was genuinely applied to source code
  const hasAppliedRepairs = repairs.some(r => r.plan !== null && r.appliedAt !== null);
  const candidateAfter = afterSnapshot !== undefined ? afterSnapshot : (existing?.afterSnapshot ?? null);
  const effectiveAfter = hasAppliedRepairs ? candidateAfter : null;

  const delta = (hasAppliedRepairs && effectiveAfter) ? computeDelta(snapshot, effectiveAfter) : null;
  const evaluation = computeVerificationEvaluation(snapshot, effectiveAfter, repairs, delta);
  const summary = computeSummary(snapshot, repairs, effectiveAfter, delta);
  const status = deriveStatus(snapshot, repairs, effectiveAfter, evaluation);

  const report: ProjectReport = {
    id: existing?.id ?? nanoid(),
    projectPath: path.resolve(projectPath),
    projectName: snapshot.projectInfo.name,
    createdAt: new Date().toISOString(),
    status,
    summary,
    snapshot,
    repairs,
    delta,
    afterSnapshot: effectiveAfter,
  };

  saveReport(report);
  return report;
}
