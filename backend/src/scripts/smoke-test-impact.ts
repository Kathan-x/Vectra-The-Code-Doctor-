/**
 * Impact tracer smoke test — verifies tracing against 3 real findings from sample-app.
 * Usage: npx ts-node --transpile-only src/scripts/smoke-test-impact.ts
 */
import path from 'path';
import { analyzeProject } from '../analysis';
import { traceImpact } from '../analysis/impact-tracer';

const SAMPLE_APP = path.resolve(__dirname, '../../../sample-app');

async function main() {
  console.log(`\nImpact Tracer Smoke Test`);
  console.log(`Project: ${SAMPLE_APP}\n`);

  // Step 1: ensure we have analysis results (use cache if available)
  const { snapshot } = await analyzeProject(SAMPLE_APP, false);
  console.log(`Loaded snapshot: ${snapshot.findings.length} findings, ${snapshot.prioritizedIssues.length} issues\n`);

  // Step 2: pick 3 findings to trace — the most interesting ones for the demo
  const targets = [
    // BUG-003: auth bypass — if (err = null)
    snapshot.findings.find(f => f.ruleId === 'vectra/no-assign-in-condition'),
    // SEC-001: hardcoded jwtSecret
    snapshot.findings.find(f => f.ruleId === 'vectra/no-hardcoded-secret' && f.file.includes('config')),
    // BUG-002: null dereference — user.role
    snapshot.findings.find(f => f.ruleId === 'vectra/null-deref'),
    // BUG-006: floating async — _dispatchEmail
    snapshot.findings.find(f => f.ruleId === 'vectra/no-floating-async'),
  ].filter(Boolean);

  if (targets.length === 0) {
    console.error('Could not find target findings — re-run with force=true to refresh cache');
    process.exit(1);
  }

  for (const finding of targets) {
    if (!finding) continue;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`FINDING:  [${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`LOCATION: ${finding.file}:${finding.line}`);
    if (finding.evidence) console.log(`EVIDENCE: ${finding.evidence}`);
    console.log();

    const impact = traceImpact(finding, SAMPLE_APP);

    console.log(`SYMBOL:   ${impact.symbolName ?? '(module scope)'}`);
    console.log(`IN FN:    ${impact.containingFunction ?? '(module scope)'}`);
    console.log(`CONFIDENCE: ${impact.confidence}`);
    console.log(`DEPTH:    ${impact.depth}`);
    console.log();

    console.log(`AFFECTED FILES (${impact.affectedFiles.length}):`);
    impact.affectedFiles.forEach(f => console.log(`  • ${f}`));
    console.log();

    if (impact.callers.length > 0) {
      console.log(`CALLERS (${impact.callers.length}) — who calls the affected function:`);
      impact.callers.forEach(c => console.log(`  ${c.relationship === 'direct' ? '✓' : '~'} ${c.file}:${c.line}  ${c.name}  [${c.relationship}]`));
      console.log();
    }

    if (impact.callees.length > 0) {
      console.log(`CALLEES (${impact.callees.length}) — what the affected function calls:`);
      impact.callees.slice(0, 6).forEach(c => console.log(`  → ${c.name}  at ${c.file}:${c.line}`));
      if (impact.callees.length > 6) console.log(`  ... and ${impact.callees.length - 6} more`);
      console.log();
    }

    if (impact.relatedTests.length > 0) {
      console.log(`RELATED TESTS (${impact.relatedTests.length}):`);
      impact.relatedTests.forEach(t => console.log(`  🧪 ${t}`));
    } else {
      console.log(`RELATED TESTS: none found`);
    }
    console.log();
  }

  console.log('Impact tracer smoke test complete.\n');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
