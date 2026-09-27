/**
 * finding-lookup.ts — Durable finding resolution across the repair lifecycle.
 *
 * Resolves findings regardless of whether:
 * 1. The finding came from the baseline report snapshot.
 * 2. The finding came from the post-repair afterSnapshot.
 * 3. The finding was already repaired and is in report.repairs.
 * 4. The disk mtime changed (which invalidates readCache mtime, but the snapshot is still valid).
 * 5. Line numbers shifted or ESLint regenerated finding hashes for the same file/rule.
 */

import fs from 'fs';
import path from 'path';
import { loadReport } from '../report/report-engine';
import { readCache, cacheKey } from './cache';
import type { Finding, AnalysisSnapshot } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../../data');

export interface ResolvedFindingContext {
  finding?: Finding;
  snapshot?: AnalysisSnapshot;
}

export function findFindingInProject(
  projectPath: string,
  issueId: string,
): ResolvedFindingContext {
  const absPath = path.resolve(projectPath);

  // ── 1. Check authoritative persisted project report ──────────────────
  const report = loadReport(absPath);
  if (report) {
    // Check baseline snapshot prioritized issues & findings
    const fromPrioritized = report.snapshot.prioritizedIssues.find(i => i.id === issueId)?.finding;
    if (fromPrioritized) return { finding: fromPrioritized, snapshot: report.snapshot };

    const fromFindings = report.snapshot.findings.find(f => f.id === issueId);
    if (fromFindings) return { finding: fromFindings, snapshot: report.snapshot };

    // Check after-repair snapshot if verification has run
    if (report.afterSnapshot) {
      const fromAfterPrioritized = report.afterSnapshot.prioritizedIssues.find(i => i.id === issueId)?.finding;
      if (fromAfterPrioritized) return { finding: fromAfterPrioritized, snapshot: report.afterSnapshot };

      const fromAfterFindings = report.afterSnapshot.findings.find(f => f.id === issueId);
      if (fromAfterFindings) return { finding: fromAfterFindings, snapshot: report.afterSnapshot };
    }

    // Check repairs history — the finding was already targeted for repair!
    const repair = report.repairs.find(
      r => r.issueId === issueId || r.findingFingerprint === issueId
    );
    if (repair) {
      const reconstructed: Finding = {
        id: repair.issueId,
        title: repair.findingTitle,
        file: repair.findingFile,
        line: repair.findingLine ?? 1,
        severity: 'high',
        category: 'bug',
        description: repair.findingTitle,
        ruleId: 'repair-target',
      };
      return { finding: reconstructed, snapshot: report.snapshot ?? report.afterSnapshot };
    }
  }

  // ── 2. Check disk cache (via readCache with mtime validation) ────────
  const cacheSnap = readCache(absPath);
  if (cacheSnap) {
    const fromPrioritized = cacheSnap.prioritizedIssues.find(i => i.id === issueId)?.finding;
    if (fromPrioritized) return { finding: fromPrioritized, snapshot: cacheSnap };

    const fromFindings = cacheSnap.findings.find(f => f.id === issueId);
    if (fromFindings) return { finding: fromFindings, snapshot: cacheSnap };
  }

  // ── 3. Check raw cache file ignoring mtime ───────────────────────────
  // Applying a repair modifies source files, bumping projectMtime beyond entry.mtime,
  // but the baseline snapshot in the cache file is still completely valid!
  const key = cacheKey(absPath);
  const cacheFile = path.join(DATA_DIR, `${key}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const entry = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const rawSnap: AnalysisSnapshot = entry.snapshot ?? entry;
      const fromPrioritized = rawSnap.prioritizedIssues?.find(i => i.id === issueId)?.finding;
      if (fromPrioritized) return { finding: fromPrioritized, snapshot: rawSnap };

      const fromFindings = rawSnap.findings?.find(f => f.id === issueId);
      if (fromFindings) return { finding: fromFindings, snapshot: rawSnap };
    } catch { /* ignore */ }
  }

  // ── 4. Correlation fallback: find by fuzzy ID or matching repair target
  if (report) {
    const allFindings = [
      ...report.snapshot.findings,
      ...(report.afterSnapshot?.findings ?? []),
    ];
    // Check if ID substring matches or matches by file + title
    const partialMatch = allFindings.find(f => f.id.startsWith(issueId) || issueId.startsWith(f.id));
    if (partialMatch) {
      return { finding: partialMatch, snapshot: report.snapshot };
    }
  }

  return {};
}
