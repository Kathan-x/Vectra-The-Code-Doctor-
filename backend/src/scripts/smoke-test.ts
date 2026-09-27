// Quick smoke test: run the full analysis pipeline against sample-app
// Usage: npx ts-node src/scripts/smoke-test.ts
import path from 'path';
import { analyzeProject } from '../analysis';

async function main() {
  const sampleAppPath = path.resolve(__dirname, '../../../sample-app');
  console.log(`\nAnalyzing: ${sampleAppPath}\n`);

  const { snapshot, cacheHit } = await analyzeProject(sampleAppPath, true /* force */);

  console.log('=== PROJECT INFO ===');
  console.log(`  Name:     ${snapshot.projectInfo.name}`);
  console.log(`  Language: ${snapshot.projectInfo.language}`);
  console.log(`  Framework: ${snapshot.projectInfo.framework ?? 'none'}`);
  console.log(`  Source files: ${snapshot.projectInfo.fileCount}`);
  console.log(`  Test files:   ${snapshot.projectInfo.testFiles.length}`);

  console.log('\n=== TEST RESULTS ===');
  const tr = snapshot.testResults;
  console.log(`  Total: ${tr.total}  Passed: ${tr.passed}  Failed: ${tr.failed}`);
  if (tr.tests.length > 0) {
    console.log('\n  Failing tests:');
    tr.tests.filter(t => t.status === 'failed').forEach(t => {
      console.log(`  ❌  ${t.name}`);
      if (t.errorMessage) console.log(`       ${t.errorMessage.split('\n')[0]}`);
    });
  }

  console.log(`\n=== FINDINGS (${snapshot.findings.length} total) ===`);
  const bySev: Record<string, number> = {};
  for (const f of snapshot.findings) bySev[f.severity] = (bySev[f.severity] ?? 0) + 1;
  Object.entries(bySev).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}`));

  console.log('\n=== TOP 10 PRIORITIZED ISSUES ===');
  snapshot.prioritizedIssues.slice(0, 10).forEach((issue, i) => {
    const f = issue.finding;
    console.log(`  ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
    console.log(`     ${f.file}:${f.line}  score=${issue.score}  failingTest=${issue.hasFailingTest}`);
    if (f.evidence) console.log(`     > ${f.evidence}`);
  });

  console.log(`\nCache hit: ${cacheHit}`);
  console.log('Smoke test complete.\n');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
