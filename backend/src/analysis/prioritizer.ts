import type { Finding, PrioritizedIssue, TestResult, Severity } from '../types';

// ── Severity weight (0–40 points) ────────────────────────────────────

const SEVERITY_SCORE: Record<Severity, number> = {
  critical: 40,
  high:     28,
  medium:   16,
  low:       6,
  info:      2,
};

// ── Blast radius: how many unique source files import/use the affected file ─

function estimateBlastRadius(finding: Finding, allFindings: Finding[]): number {
  // Count how many other findings share the same file (proxy for importance of file)
  const sameFile = allFindings.filter(f => f.file === finding.file).length;
  return Math.max(1, sameFile);
}

// ── Failing test correlation ──────────────────────────────────────────

function findRelatedTests(finding: Finding, testResults: TestResult[]): string[] {
  const fileBase = finding.file.replace(/^.*[\\/]/, '').replace(/\.[jt]sx?$/, '');
  return testResults
    .filter(t => {
      const testBase = t.file.replace(/^.*[\\/]/, '').replace(/\.test\.[jt]sx?$/, '').replace(/\.spec\.[jt]sx?$/, '');
      return testBase === fileBase || testBase.includes(fileBase) || fileBase.includes(testBase);
    })
    .map(t => t.file);
}

function hasRelatedFailingTest(relatedTests: string[], failingTests: TestResult[]): boolean {
  const failingFiles = new Set(failingTests.map(t => t.file));
  return relatedTests.some(f => failingFiles.has(f));
}

// ── Deduplication: merge findings with same ruleId + file + line ──────

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.ruleId ?? ''}::${f.file}::${f.line}`;
    if (!seen.has(key)) {
      seen.set(key, f);
    } else {
      // Keep the one with higher severity
      const existing = seen.get(key)!;
      if (SEVERITY_SCORE[f.severity] > SEVERITY_SCORE[existing.severity]) {
        seen.set(key, f);
      }
    }
  }
  return Array.from(seen.values());
}

// ── Main prioritizer ──────────────────────────────────────────────────

export function prioritizeFindings(
  findings: Finding[],
  testResults: TestResult[],
): PrioritizedIssue[] {
  const deduplicated = deduplicateFindings(findings);
  const failingTests = testResults.filter(t => t.status === 'failed');

  return deduplicated
    .map((finding): PrioritizedIssue => {
      const blastRadius = estimateBlastRadius(finding, deduplicated);
      const relatedTests = findRelatedTests(finding, testResults);
      const hasFailing = hasRelatedFailingTest(relatedTests, failingTests);

      // Score: severity (0–40) + blast radius bonus (0–20) + failing test bonus (0–20) + category bonus (0–20)
      const sevScore = SEVERITY_SCORE[finding.severity];
      const radiusScore = Math.min(20, blastRadius * 4);
      const testScore = hasFailing ? 20 : 0;
      const categoryBonus = finding.category === 'security' ? 20
        : finding.category === 'bug' ? 10
        : finding.category === 'async' ? 8
        : finding.category === 'test' ? 5
        : 0; // quality

      const rawScore = sevScore + radiusScore + testScore + categoryBonus;
      const score = Math.min(100, rawScore);

      return {
        id: finding.id,
        finding,
        score,
        blastRadius,
        hasFailingTest: hasFailing,
        relatedTests: [...new Set(relatedTests)],
      };
    })
    .sort((a, b) => b.score - a.score);
}
