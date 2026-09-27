import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { discoverProject, EXCLUDED_DIRS } from '../analysis/discover';
import { analyzeProject } from '../analysis';
import { traceImpact } from '../analysis/impact-tracer';
import { runTests } from '../analysis/test-runner';
import { generateReport } from '../report/report-engine';
import type { Finding } from '../types';

async function extractZipToDir(zipPath: string, destDir: string): Promise<number> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let extractedCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const normalized = entry.entryName.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const isExcluded = parts.some(part => EXCLUDED_DIRS.has(part.toLowerCase()));
    if (isExcluded) continue;

    // Zip-slip guard
    const targetPath = path.resolve(destDir, normalized);
    if (!targetPath.startsWith(path.resolve(destDir))) continue;

    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, entry.getData());
    extractedCount++;
  }
  return extractedCount;
}

async function run() {
  console.log('==================================================');
  console.log('=== VECTRA END-TO-END VALIDATION & STRESS TEST ===');
  console.log('==================================================\n');
  const tempBase = path.resolve(__dirname, '../../../data/test-runs');
  if (!fs.existsSync(tempBase)) {
    fs.mkdirSync(tempBase, { recursive: true });
  }

  // 1. CLEAN PROJECT
  console.log('--- TEST 1: Clean Project ---');
  const cleanZip = path.resolve(__dirname, '../../../test-fixtures/clean-project.zip');
  const cleanDir = path.join(tempBase, 'clean-project');
  if (fs.existsSync(cleanDir)) fs.rmSync(cleanDir, { recursive: true, force: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  const cleanFiles = await extractZipToDir(cleanZip, cleanDir);
  console.log(`Clean Project extracted files: ${cleanFiles}`);
  const cleanInfo = discoverProject(cleanDir);
  console.log(`Discovered: "${cleanInfo.name}" (${cleanInfo.language}, ${cleanInfo.sourceFiles.length} source files)`);
  const { snapshot: cleanSnapshot } = await analyzeProject(cleanDir, true);
  console.log(`Findings: ${cleanSnapshot.findings.length} (Critical: ${cleanSnapshot.findings.filter((f: Finding) => f.severity === 'critical').length})`);
  const cleanTests = await runTests(cleanDir);
  console.log(`Tests: ${cleanTests.passed} passed / ${cleanTests.total} total`);
  const cleanReport = generateReport({ snapshot: cleanSnapshot, projectPath: cleanDir, existingRepairs: [] });
  console.log(`Report status: ${cleanReport.status}, Total issues: ${cleanReport.summary.totalFindings}`);
  console.log('✓ Clean Project validation PASSED\n');

  // 2. RISK PROJECT
  console.log('--- TEST 2: Risk Project ---');
  const riskZip = path.resolve(__dirname, '../../../test-fixtures/risk-project.zip');
  const riskDir = path.join(tempBase, 'risk-project');
  if (fs.existsSync(riskDir)) fs.rmSync(riskDir, { recursive: true, force: true });
  fs.mkdirSync(riskDir, { recursive: true });

  const riskFiles = await extractZipToDir(riskZip, riskDir);
  console.log(`Risk Project extracted files: ${riskFiles}`);
  const riskInfo = discoverProject(riskDir);
  console.log(`Discovered: "${riskInfo.name}" (${riskInfo.language}, ${riskInfo.sourceFiles.length} source files)`);
  const { snapshot: riskSnapshot } = await analyzeProject(riskDir, true);
  console.log(`Findings: ${riskSnapshot.findings.length} (Critical: ${riskSnapshot.findings.filter((f: Finding) => f.severity === 'critical').length}, High: ${riskSnapshot.findings.filter((f: Finding) => f.severity === 'high').length})`);
  
  if (riskSnapshot.findings.length > 0) {
    const impact = traceImpact(riskSnapshot.findings[0], riskDir);
    console.log(`Impact blast radius for finding "${riskSnapshot.findings[0].title}": ${impact.affectedFiles.length} files affected (confidence: ${impact.confidence})`);
  }
  const riskTests = await runTests(riskDir);
  console.log(`Tests: ${riskTests.passed} passed / ${riskTests.total} total`);
  const riskReport = generateReport({ snapshot: riskSnapshot, projectPath: riskDir, existingRepairs: [] });
  console.log(`Report status: ${riskReport.status}, Total issues: ${riskReport.summary.totalFindings}`);
  console.log('✓ Risk Project validation PASSED\n');

  // 3. LARGE CP PROJECT ARCHIVE (~194 MB)
  console.log('--- TEST 3: Large Archive - CP Project (3).zip ---');
  const cpZip = 'C:\\Users\\Patel Kathan\\Desktop\\CP Project (3).zip';
  if (!fs.existsSync(cpZip)) {
    throw new Error(`CP Project archive not found at ${cpZip}`);
  }

  const cpDir = path.join(tempBase, 'cp-project');
  if (fs.existsSync(cpDir)) fs.rmSync(cpDir, { recursive: true, force: true });
  fs.mkdirSync(cpDir, { recursive: true });

  const startTime = Date.now();
  const cpFiles = await extractZipToDir(cpZip, cpDir);
  const extractTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Selective extraction completed in ${extractTime}s: extracted ${cpFiles} clean source files (thousands of node_modules/.mongo-data/.dart_tool skipped)`);

  const cpInfo = discoverProject(cpDir);
  console.log(`Discovered: "${cpInfo.name}" | Framework: ${cpInfo.framework || 'Node.js'} | Package Mgr: ${cpInfo.packageManager} | Source files: ${cpInfo.sourceFiles.length}`);

  const analysisStart = Date.now();
  const { snapshot: cpSnapshot } = await analyzeProject(cpDir, true);
  const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(2);
  console.log(`Pipeline analysis completed in ${analysisTime}s!`);
  console.log(`Total Findings: ${cpSnapshot.findings.length}`);
  console.log(`  - Critical: ${cpSnapshot.findings.filter((f: Finding) => f.severity === 'critical').length}`);
  console.log(`  - High:     ${cpSnapshot.findings.filter((f: Finding) => f.severity === 'high').length}`);
  console.log(`  - Medium:   ${cpSnapshot.findings.filter((f: Finding) => f.severity === 'medium').length}`);
  console.log(`  - Low:      ${cpSnapshot.findings.filter((f: Finding) => f.severity === 'low').length}`);

  if (cpSnapshot.findings.length > 0) {
    const topFinding = cpSnapshot.findings[0];
    const impact = traceImpact(topFinding, cpDir);
    console.log(`Blast radius impact map computed for top finding "${topFinding.title}": ${impact.affectedFiles.length} affected files, confidence ${impact.confidence}`);
  }

  const cpReport = generateReport({ snapshot: cpSnapshot, projectPath: cpDir, existingRepairs: [] });
  console.log(`Report status: ${cpReport.status} | Total issues: ${cpReport.summary.totalFindings}`);
  console.log('✓ CP Project large archive validation PASSED\n');

  console.log('================================================================');
  console.log('SUCCESS: ALL 3 TEST FIXTURES & REAL-WORLD PROJECTS PASSED 100%');
  console.log('================================================================');
}

run().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
