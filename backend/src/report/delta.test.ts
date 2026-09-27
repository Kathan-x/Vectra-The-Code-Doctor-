import { describe, it, expect } from 'vitest';
import { computeDelta, computeVerificationEvaluation } from './report-engine';
import type { AnalysisSnapshot, Finding } from '../types';

function createDummySnapshot(findings: Finding[]): AnalysisSnapshot {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      name: 'test-project',
      path: '/dummy',
      fileCount: 0,
      sourceFiles: [],
      testFiles: [],
      packageManager: undefined,
      framework: undefined,
      language: 'javascript',
      scope: { totalFiles: 0, analyzedFiles: 0, testFiles: 0, excludedFiles: 0 },
      composition: [],
    },
    findings,
    prioritizedIssues: [],
    testResults: {
      total: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
      duration: 10,
      tests: [],
      rawOutput: '',
    },
  };
}

describe('computeDelta: 1-to-1 bipartite matching', () => {
  it('correctly tracks persisting findings across significant line-number shifts without phantom resolved/newly-introduced findings', () => {
    // 3 findings in file A before repair
    const beforeFindings: Finding[] = [
      {
        id: 'f_before_1',
        file: 'src/app.js',
        line: 10,
        ruleId: 'no-undef',
        title: "'fetch' is not defined",
        evidence: 'const r = await fetch("/api");',
        severity: 'high',
        category: 'bug',
        description: 'ESLint: no-undef',
      },
      {
        id: 'f_before_2',
        file: 'src/app.js',
        line: 25,
        ruleId: 'no-undef',
        title: "'document' is not defined",
        evidence: 'document.getElementById("btn");',
        severity: 'high',
        category: 'bug',
        description: 'ESLint: no-undef',
      },
      {
        id: 'f_before_3',
        file: 'src/app.js',
        line: 40,
        ruleId: 'no-unused-vars',
        title: "'unused' is defined but never used",
        evidence: 'const unused = 1;',
        severity: 'medium',
        category: 'quality',
        description: 'ESLint: no-unused-vars',
      },
    ];

    // Repair resolved finding 1 (fetch), but inserted 10 lines at the top of the file!
    // As a result: finding 2 moved from line 25 to line 35 (+10 shift!)
    // finding 3 moved from line 40 to line 50 (+10 shift!)
    const afterFindings: Finding[] = [
      {
        id: 'f_after_2_shifted',
        file: 'src/app.js',
        line: 35, // shifted by +10 lines
        ruleId: 'no-undef',
        title: "'document' is not defined",
        evidence: 'document.getElementById("btn");',
        severity: 'high',
        category: 'bug',
        description: 'ESLint: no-undef',
      },
      {
        id: 'f_after_3_shifted',
        file: 'src/app.js',
        line: 50, // shifted by +10 lines
        ruleId: 'no-unused-vars',
        title: "'unused' is defined but never used",
        evidence: 'const unused = 1;',
        severity: 'medium',
        category: 'quality',
        description: 'ESLint: no-unused-vars',
      },
    ];

    const delta = computeDelta(createDummySnapshot(beforeFindings), createDummySnapshot(afterFindings));

    // Finding 1 was truly resolved!
    expect(delta.resolvedFindingIds).toEqual(['f_before_1']);
    // Findings 2 and 3 persisted despite a 10-line shift!
    expect(delta.remainingFindingIds).toEqual(['f_before_2', 'f_before_3']);
    // Zero phantom "new" findings introduced!
    expect(delta.newFindingIds).toEqual([]);

    // Mathematical guarantees
    expect(delta.findingsBefore).toBe(delta.resolvedFindingIds.length + delta.remainingFindingIds.length);
    expect(delta.findingsAfter).toBe(delta.remainingFindingIds.length + delta.newFindingIds.length);
  });

  it('correctly reports newly introduced regressions', () => {
    const beforeFindings: Finding[] = [
      {
        id: 'f_1',
        file: 'src/math.js',
        line: 5,
        ruleId: 'no-undef',
        title: "'x' is not defined",
        evidence: 'x = 10;',
        severity: 'high',
        category: 'bug',
        description: 'ESLint',
      },
    ];

    const afterFindings: Finding[] = [
      {
        id: 'f_1',
        file: 'src/math.js',
        line: 5,
        ruleId: 'no-undef',
        title: "'x' is not defined",
        evidence: 'x = 10;',
        severity: 'high',
        category: 'bug',
        description: 'ESLint',
      },
      {
        id: 'f_new',
        file: 'src/math.js',
        line: 12,
        ruleId: 'no-eval',
        title: 'eval is not allowed',
        evidence: 'eval(userInput);',
        severity: 'critical',
        category: 'security',
        description: 'ESLint: no-eval',
      },
    ];

    const delta = computeDelta(createDummySnapshot(beforeFindings), createDummySnapshot(afterFindings));

    expect(delta.resolvedFindingIds).toEqual([]);
    expect(delta.remainingFindingIds).toEqual(['f_1']);
    expect(delta.newFindingIds).toEqual(['f_new']);
  });
});

describe('computeVerificationEvaluation: distinct failure causes & reasons', () => {
  it('correctly reports failure as issue_persists when 24/24 tests pass but targeted finding remains', () => {
    const finding: Finding = {
      id: 'f_target_1',
      file: 'src/app.js',
      line: 10,
      ruleId: 'no-undef',
      title: 'Target bug',
      severity: 'high',
      category: 'bug',
      description: 'Bug description',
    };

    const beforeSnapshot = createDummySnapshot([finding]);
    beforeSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    // After snapshot: all 24 tests passed, but the finding is STILL present!
    const afterSnapshot = createDummySnapshot([finding]);
    afterSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    const repairs = [{
      issueId: 'f_target_1',
      findingTitle: 'Target bug',
      findingFile: 'src/app.js',
      findingLine: 10,
      plan: { issueId: 'f_target_1', summary: 'Plan', steps: [], estimatedRisk: 'low' as const, rawBobResponse: '' },
      reviewResult: null,
      appliedAt: new Date().toISOString(),
    }];

    const delta = computeDelta(beforeSnapshot, afterSnapshot);
    const evaluation = computeVerificationEvaluation(beforeSnapshot, afterSnapshot, repairs, delta);

    expect(evaluation.status).toBe('failed');
    expect(evaluation.reason).toBe('issue_persists');
    expect(evaluation.reason).not.toBe('failing_tests');
  });

  it('correctly reports failure as failing_tests when targeted finding was resolved but tests fail', () => {
    const finding: Finding = {
      id: 'f_target_1',
      file: 'src/app.js',
      line: 10,
      ruleId: 'no-undef',
      title: 'Target bug',
      severity: 'high',
      category: 'bug',
      description: 'Bug description',
    };

    const beforeSnapshot = createDummySnapshot([finding]);
    beforeSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    // After snapshot: finding was resolved (0 findings), but 4 tests failed!
    const afterSnapshot = createDummySnapshot([]);
    afterSnapshot.testResults = {
      total: 24,
      passed: 20,
      failed: 4,
      skipped: 0,
      duration: 120,
      tests: [],
      rawOutput: '',
    };

    const repairs = [{
      issueId: 'f_target_1',
      findingTitle: 'Target bug',
      findingFile: 'src/app.js',
      findingLine: 10,
      plan: { issueId: 'f_target_1', summary: 'Plan', steps: [], estimatedRisk: 'low' as const, rawBobResponse: '' },
      reviewResult: null,
      appliedAt: new Date().toISOString(),
    }];

    const delta = computeDelta(beforeSnapshot, afterSnapshot);
    const evaluation = computeVerificationEvaluation(beforeSnapshot, afterSnapshot, repairs, delta);

    expect(evaluation.status).toBe('failed');
    expect(evaluation.reason).toBe('failing_tests');
  });

  it('correctly reports passed as all_checks_passed when all tests pass and targeted finding is resolved', () => {
    const finding: Finding = {
      id: 'f_target_1',
      file: 'src/app.js',
      line: 10,
      ruleId: 'no-undef',
      title: 'Target bug',
      severity: 'high',
      category: 'bug',
      description: 'Bug description',
    };

    const beforeSnapshot = createDummySnapshot([finding]);
    beforeSnapshot.testResults = {
      total: 24,
      passed: 23,
      failed: 1,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    // After snapshot: finding resolved and failing test now passes clean!
    const afterSnapshot = createDummySnapshot([]);
    afterSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    const repairs = [{
      issueId: 'f_target_1',
      findingTitle: 'Target bug',
      findingFile: 'src/app.js',
      findingLine: 10,
      plan: { issueId: 'f_target_1', summary: 'Plan', steps: [], estimatedRisk: 'low' as const, rawBobResponse: '' },
      reviewResult: { issueId: 'f_target_1', status: 'approved' as const, summary: 'Approved', concerns: [], rawBobResponse: '' },
      appliedAt: new Date().toISOString(),
    }];

    const delta = computeDelta(beforeSnapshot, afterSnapshot);
    const evaluation = computeVerificationEvaluation(beforeSnapshot, afterSnapshot, repairs, delta);

    expect(evaluation.status).toBe('passed');
    expect(evaluation.reason).toBe('all_checks_passed');
  });

  it('correctly reports partial as review_concern when tests pass and finding is resolved but review flagged concerns', () => {
    const finding: Finding = {
      id: 'f_target_1',
      file: 'src/app.js',
      line: 10,
      ruleId: 'no-undef',
      title: 'Target bug',
      severity: 'high',
      category: 'bug',
      description: 'Bug description',
    };

    const beforeSnapshot = createDummySnapshot([finding]);
    beforeSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    const afterSnapshot = createDummySnapshot([]);
    afterSnapshot.testResults = {
      total: 24,
      passed: 24,
      failed: 0,
      skipped: 0,
      duration: 100,
      tests: [],
      rawOutput: '',
    };

    const repairs = [{
      issueId: 'f_target_1',
      findingTitle: 'Target bug',
      findingFile: 'src/app.js',
      findingLine: 10,
      plan: { issueId: 'f_target_1', summary: 'Plan', steps: [], estimatedRisk: 'low' as const, rawBobResponse: '' },
      reviewResult: {
        issueId: 'f_target_1',
        status: 'concerns' as const,
        summary: 'Concerns noted',
        concerns: [{ severity: 'high' as const, description: 'Possible security anti-pattern', file: 'src/app.js', line: 12 }],
        rawBobResponse: '',
      },
      appliedAt: new Date().toISOString(),
    }];

    const delta = computeDelta(beforeSnapshot, afterSnapshot);
    const evaluation = computeVerificationEvaluation(beforeSnapshot, afterSnapshot, repairs, delta);

    expect(evaluation.status).toBe('partial');
    expect(evaluation.reason).toBe('review_concern');
  });
});
