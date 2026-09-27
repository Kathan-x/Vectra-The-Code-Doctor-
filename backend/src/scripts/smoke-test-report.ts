/**
 * Report engine smoke test — no Bob, no network, zero Bobcoins.
 * Usage: npx ts-node --transpile-only src/scripts/smoke-test-report.ts
 */
import path from 'path';
import { analyzeProject } from '../analysis';
import { generateReport, loadReport, computeSummary, deriveStatus, computeDelta } from '../report/report-engine';

const SAMPLE_APP = path.resolve(__dirname, '../../../sample-app');

async function main() {
  console.log('\nReport Engine Smoke Test\n');

  // 1. Load analysis (cache or fresh)
  const { snapshot, cacheHit } = await analyzeProject(SAMPLE_APP, false);
  console.log(`Analysis: ${snapshot.findings.length} findings, ${snapshot.testResults.total} tests (cache=${cacheHit})`);

  // 2. Generate report from snapshot alone (no repairs)
  const report = generateReport({ snapshot, projectPath: SAMPLE_APP });

  // 3. Assertions
  let passed = 0; let failed = 0;
  function assert(label: string, condition: boolean) {
    if (condition) { console.log(`  ✓ ${label}`); passed++; }
    else { console.error(`  ✗ ${label}`); failed++; }
  }

  assert('report has id', typeof report.id === 'string' && report.id.length > 0);
  assert('report has projectName', report.projectName === 'vectra-sample-app');
  assert('report status is ISSUES_FOUND', report.status === 'ISSUES_FOUND');
  assert('summary.totalFindings > 0', report.summary.totalFindings > 0);
  assert('summary.totalTests === 18', report.summary.totalTests === 18);
  assert('summary.passingTests === 13', report.summary.passingTests === 13);
  assert('summary.failingTests === 5', report.summary.failingTests === 5);
  assert('severity counts sum to totalFindings',
    Object.values(report.summary.severity).reduce((a, b) => a + b, 0) === report.summary.totalFindings
  );
  assert('category counts sum to totalFindings',
    Object.values(report.summary.categories).reduce((a, b) => a + b, 0) === report.summary.totalFindings
  );
  assert('affectedFiles > 0', report.summary.affectedFiles > 0);
  assert('verificationStatus is not_run', report.summary.verificationStatus === 'not_run');
  assert('repairs is empty array', Array.isArray(report.repairs) && report.repairs.length === 0);
  assert('delta is null (no repair run)', report.delta === null);
  assert('afterSnapshot is null', report.afterSnapshot === null);
  assert('snapshot has prioritizedIssues', report.snapshot.prioritizedIssues.length > 0);

  // 4. Serialisation
  let serialized: string;
  try { serialized = JSON.stringify(report); assert('report serializes to JSON', true); }
  catch { assert('report serializes to JSON', false); serialized = ''; }

  // 5. Round-trip: load from disk
  const loaded = loadReport(SAMPLE_APP);
  assert('loadReport returns persisted report', loaded !== null && loaded.id === report.id);

  // 6. Test delta computation with a simulated after-snapshot
  const simulatedAfter = {
    ...snapshot,
    findings: snapshot.findings.slice(2),  // pretend 2 issues were resolved
    testResults: { ...snapshot.testResults, failed: 3, passed: 15 },
  };
  const delta = computeDelta(snapshot, simulatedAfter);
  assert('delta.findingsBefore correct', delta.findingsBefore === snapshot.findings.length);
  assert('delta.findingsAfter correct', delta.findingsAfter === simulatedAfter.findings.length);
  assert('delta.resolvedFindingIds.length === 2', delta.resolvedFindingIds.length === 2);
  assert('delta.testFailingAfter === 3', delta.testFailingAfter === 3);

  // 7. Status derivation tests
  assert('deriveStatus null → NOT_ANALYZED', deriveStatus(null, [], null) === 'NOT_ANALYZED');
  assert('deriveStatus no repairs → ISSUES_FOUND', deriveStatus(snapshot, [], null) === 'ISSUES_FOUND');

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('Smoke test failed:', err); process.exit(1); });
