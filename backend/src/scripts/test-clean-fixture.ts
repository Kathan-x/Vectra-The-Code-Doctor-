import path from 'path';
import { analyzeProject } from '../analysis';

async function main() {
  const cleanPath = path.resolve(__dirname, '../../../test-fixtures/clean-project');
  console.log('Testing clean fixture at:', cleanPath);

  const { snapshot } = await analyzeProject(cleanPath, true);
  console.log('Project:', snapshot.projectInfo.name);
  console.log('Findings:', snapshot.findings.length);
  if (snapshot.findings.length > 0) {
    console.log('Unexpected findings:', snapshot.findings);
  }
  console.log('Tests total:', snapshot.testResults.total);
  console.log('Tests passed:', snapshot.testResults.passed);
  console.log('Tests failed:', snapshot.testResults.failed);
}

main().catch(console.error);
