import path from 'path';
import { analyzeProject } from '../analysis';

async function main() {
  const riskPath = path.resolve(__dirname, '../../../test-fixtures/risk-project');
  console.log('Testing risk fixture at:', riskPath);

  const { snapshot } = await analyzeProject(riskPath, true);
  console.log('Project:', snapshot.projectInfo.name);
  console.log('Findings count:', snapshot.findings.length);
  for (const f of snapshot.findings) {
    console.log(`  - [${f.severity.toUpperCase()}] (${f.category}) ${f.title} @ ${f.file}:${f.line}`);
  }
  console.log('Prioritized issues:');
  for (const i of snapshot.prioritizedIssues) {
    console.log(`  - #${i.score} [${i.finding.severity.toUpperCase()}] ${i.finding.title} (failingTest=${i.hasFailingTest})`);
  }
  console.log('Tests total:', snapshot.testResults.total);
  console.log('Tests passed:', snapshot.testResults.passed);
  console.log('Tests failed:', snapshot.testResults.failed);
}

main().catch(console.error);
