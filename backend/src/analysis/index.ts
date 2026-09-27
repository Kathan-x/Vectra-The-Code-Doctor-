import type { AnalysisSnapshot } from '../types';
import { discoverProject } from './discover';
import { runEslint } from './eslint-runner';
import { runAstAnalysis } from './ast-analyzer';
import { runTests } from './test-runner';
import { prioritizeFindings } from './prioritizer';
import { readCache, writeCache, cacheKey } from './cache';

export { cacheKey };

export async function analyzeProject(
  projectPath: string,
  force = false,
): Promise<{ snapshot: AnalysisSnapshot; cacheHit: boolean }> {
  // 1. Check cache
  if (!force) {
    const cached = readCache(projectPath);
    if (cached) {
      return { snapshot: cached, cacheHit: true };
    }
  }

  // 2. Discover project structure (deterministic, fast)
  const projectInfo = discoverProject(projectPath);

  // 3. Run ESLint and AST analysis in parallel (both read-only, no side effects)
  const [eslintFindings, astFindings, testResults] = await Promise.all([
    runEslint(projectPath, projectInfo.sourceFiles),
    Promise.resolve(runAstAnalysis(projectPath, projectInfo.sourceFiles)),
    runTests(projectPath, projectInfo.testFiles),
  ]);

  // 4. Merge all findings
  const allFindings = [...eslintFindings, ...astFindings];

  // 5. Prioritize (score + sort + deduplicate)
  const prioritizedIssues = prioritizeFindings(allFindings, testResults.tests);

  // 6. Build snapshot
  const snapshot: AnalysisSnapshot = {
    timestamp: new Date().toISOString(),
    projectInfo,
    findings: allFindings,
    prioritizedIssues,
    testResults,
  };

  // 7. Write cache
  writeCache(projectPath, snapshot);

  return { snapshot, cacheHit: false };
}
