import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { TestSuiteResult, TestResult } from '../types';
import { findPackageJson, discoverProject } from './discover';

// ── Jest JSON output parser ───────────────────────────────────────────

interface JestAssertionResult {
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
  duration?: number;
  failureMessages?: string[];
}

interface JestTestSuiteResult {
  name?: string;
  testFilePath?: string;
  assertionResults?: JestAssertionResult[];
  testResults?: JestAssertionResult[];
}

interface JestOutput {
  success: boolean;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: JestTestSuiteResult[];
  startTime: number;
  numTotalTests?: number;
}

function parseJestOutput(
  projectPath: string,
  jsonStr: string,
  cwd: string,
  commandUsed: string
): TestSuiteResult {
  let jestData: JestOutput;
  try {
    jestData = JSON.parse(jsonStr) as JestOutput;
  } catch {
    return {
      total: 0, passed: 0, failed: 0, skipped: 0, duration: 0,
      tests: [], rawOutput: jsonStr,
      commandUsed,
      workingDirectory: cwd,
      executionStatus: 'unable_to_execute',
      statusMessage: 'Failed to parse test runner output',
    };
  }

  const tests: TestResult[] = [];
  for (const suite of jestData.testResults ?? []) {
    const rawPath = suite.name || suite.testFilePath || '';
    const relFile = rawPath ? path.relative(projectPath, rawPath).replace(/\\/g, '/') : 'test';
    const assertions = suite.assertionResults || suite.testResults || [];
    for (const t of assertions) {
      tests.push({
        name: t.fullName,
        file: relFile,
        status: t.status === 'passed' ? 'passed'
          : t.status === 'failed' ? 'failed'
          : 'skipped',
        duration: t.duration ?? undefined,
        errorMessage: t.failureMessages?.join('\n') || undefined,
      });
    }
  }

  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const skipped = tests.filter(t => t.status === 'skipped').length;
  const duration = Date.now() - jestData.startTime;
  const total = passed + failed + skipped;

  return {
    total,
    passed,
    failed,
    skipped,
    duration,
    tests,
    rawOutput: jsonStr,
    commandUsed,
    workingDirectory: cwd,
    analysisRoot: projectPath,
    testWorkingDirectory: cwd,
    executionStatus: failed > 0 ? 'failed' : 'passed',
    statusMessage: `${passed} passed, ${failed} failed (${total} total)`,
  };
}

// ── Node.js Native / TAP Test Output Parser ────────────────────────────

function parseNodeTestOutput(
  raw: string,
  projectPath: string,
  cwd: string,
  commandUsed: string,
  defaultFile: string
): TestSuiteResult {
  const tests: TestResult[] = [];
  const lines = raw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Spec reporter check: ✔ test-name (3.2ms)
    const passMatch = line.match(/^[✔√\u2714\u221A]\s+(.+?)(?:\s+\(([\d.]+)m?s\))?$/);
    if (passMatch) {
      tests.push({
        name: passMatch[1].trim(),
        file: defaultFile,
        status: 'passed',
        duration: passMatch[2] ? parseFloat(passMatch[2]) : undefined,
      });
      continue;
    }

    // Spec reporter check: ✖ test-name (3.2ms)
    const failMatch = line.match(/^[✖×\u2716\u00D7]\s+(.+?)(?:\s+\(([\d.]+)m?s\))?$/);
    if (failMatch) {
      let errMsg = '';
      let j = i + 1;
      while (j < lines.length && (lines[j].startsWith(' ') || lines[j].startsWith('\t'))) {
        errMsg += lines[j] + '\n';
        j++;
      }
      tests.push({
        name: failMatch[1].trim(),
        file: defaultFile,
        status: 'failed',
        duration: failMatch[2] ? parseFloat(failMatch[2]) : undefined,
        errorMessage: errMsg.trim() || undefined,
      });
      continue;
    }

    // TAP pass: ok 1 - test-name
    const tapPass = line.match(/^ok\s+\d+\s+-\s+(.+?)(?:\s*#.*)?$/);
    if (tapPass) {
      tests.push({ name: tapPass[1].trim(), file: defaultFile, status: 'passed' });
      continue;
    }

    // TAP fail: not ok 1 - test-name
    const tapFail = line.match(/^not ok\s+\d+\s+-\s+(.+?)(?:\s*#.*)?$/);
    if (tapFail) {
      tests.push({ name: tapFail[1].trim(), file: defaultFile, status: 'failed' });
      continue;
    }
  }

  // Summary lines: "ℹ tests 24", "ℹ pass 24", "ℹ fail 0"
  const testsMatch = raw.match(/[ℹ#]\s*tests\s+(\d+)/);
  const passMatch  = raw.match(/[ℹ#]\s*pass(?:ed)?\s+(\d+)/);
  const failMatch  = raw.match(/[ℹ#]\s*fail(?:ed)?\s+(\d+)/);
  const skipMatch  = raw.match(/[ℹ#]\s*skipped\s+(\d+)/);
  const durMatch   = raw.match(/[ℹ#]\s*duration(?:_ms)?\s+([\d.]+)/);

  const total = testsMatch ? parseInt(testsMatch[1], 10) : tests.length;
  const passed = passMatch ? parseInt(passMatch[1], 10) : tests.filter(t => t.status === 'passed').length;
  const failed = failMatch ? parseInt(failMatch[1], 10) : tests.filter(t => t.status === 'failed').length;
  const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;
  const duration = durMatch ? Math.round(parseFloat(durMatch[1])) : 0;

  return {
    total,
    passed,
    failed,
    skipped,
    duration,
    tests,
    rawOutput: raw,
    commandUsed,
    workingDirectory: cwd,
    analysisRoot: projectPath,
    testWorkingDirectory: cwd,
    executionStatus: failed > 0 ? 'failed' : 'passed',
    statusMessage: `${passed} passed, ${failed} failed (${total} total)`,
  };
}

// ── Fallback: parse Jest text output ─────────────────────────────────

function parseJestTextOutput(output: string): Partial<TestSuiteResult> {
  const summary = output.match(/Tests:\s*(.*)/);
  if (!summary) return {};

  const passedMatch = summary[1].match(/(\d+) passed/);
  const failedMatch = summary[1].match(/(\d+) failed/);
  const totalMatch = summary[1].match(/(\d+) total/);
  const timeMatch = output.match(/Time:\s*([\d.]+)\s*s/);

  return {
    passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
    failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
    total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
    skipped: 0,
    duration: timeMatch ? Math.round(parseFloat(timeMatch[1]) * 1000) : 0,
  };
}

// ── Detection and resolution ──────────────────────────────────────────

type TestRunnerType = 'jest' | 'vitest' | 'node-test' | 'npm-test' | 'unsupported' | 'none';

interface ResolvedTestConfig {
  type: TestRunnerType;
  cwd: string;
  commandUsed: string;
  testFiles: string[];
}

function resolveTestConfig(projectPath: string, testFiles?: string[]): ResolvedTestConfig {
  const absRoot = path.resolve(projectPath);

  // If testFiles not explicitly passed, discover from project
  const effectiveTestFiles = (testFiles && testFiles.length > 0)
    ? testFiles
    : discoverProject(absRoot).testFiles;

  if (effectiveTestFiles.length === 0) {
    return {
      type: 'none',
      cwd: absRoot,
      commandUsed: 'none',
      testFiles: [],
    };
  }

  // Find nearest package.json for the first detected test file
  const firstAbsTest = path.resolve(absRoot, effectiveTestFiles[0]);
  let checkDir = path.dirname(firstAbsTest);
  let packageDir: string | null = null;

  while (checkDir.length >= absRoot.length && checkDir !== path.dirname(checkDir)) {
    if (fs.existsSync(path.join(checkDir, 'package.json'))) {
      packageDir = checkDir;
      break;
    }
    checkDir = path.dirname(checkDir);
  }

  if (!packageDir) {
    const fallback = findPackageJson(absRoot);
    packageDir = fallback ? fallback.dir : absRoot;
  }

  let pkgJson: Record<string, any> = {};
  try {
    const pkgPath = path.join(packageDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
  } catch {}

  const scripts = pkgJson.scripts ?? {};
  const testScript: string | undefined = scripts.test;
  const deps = {
    ...(pkgJson.dependencies ?? {}),
    ...(pkgJson.devDependencies ?? {}),
  };

  const isDummyTestScript = !testScript ||
    testScript.includes('no test specified') ||
    testScript.trim() === 'exit 1';

  // 1. If explicit npm test script is defined and runnable
  if (testScript && !isDummyTestScript) {
    if (testScript.includes('node --test') || testScript.includes('node test')) {
      return {
        type: 'node-test',
        cwd: packageDir,
        commandUsed: testScript,
        testFiles: effectiveTestFiles,
      };
    }
    if (testScript.includes('jest') || deps['jest'] || deps['@jest/core']) {
      return {
        type: 'jest',
        cwd: packageDir,
        commandUsed: 'jest --json',
        testFiles: effectiveTestFiles,
      };
    }
    if (testScript.includes('vitest') || deps['vitest']) {
      return {
        type: 'vitest',
        cwd: packageDir,
        commandUsed: 'vitest run --reporter=json',
        testFiles: effectiveTestFiles,
      };
    }
    return {
      type: 'npm-test',
      cwd: packageDir,
      commandUsed: 'npm test',
      testFiles: effectiveTestFiles,
    };
  }

  // 2. No test script in package.json, check dependencies
  if (deps['jest'] || deps['@jest/core']) {
    return {
      type: 'jest',
      cwd: packageDir,
      commandUsed: 'jest --json',
      testFiles: effectiveTestFiles,
    };
  }
  if (deps['vitest']) {
    return {
      type: 'vitest',
      cwd: packageDir,
      commandUsed: 'vitest run --reporter=json',
      testFiles: effectiveTestFiles,
    };
  }

  // 3. Check if files end in .test.js or .test.ts -> node --test
  const hasNodeTestFiles = effectiveTestFiles.some(f => f.endsWith('.test.js') || f.endsWith('.test.mjs'));
  if (hasNodeTestFiles) {
    return {
      type: 'node-test',
      cwd: packageDir,
      commandUsed: 'node --test',
      testFiles: effectiveTestFiles,
    };
  }

  // 4. Test files were detected, but no runnable runner exists
  return {
    type: 'unsupported',
    cwd: packageDir,
    commandUsed: 'none',
    testFiles: effectiveTestFiles,
  };
}

// ── Runner implementation ─────────────────────────────────────────────

export async function runTests(projectPath: string, testFiles?: string[]): Promise<TestSuiteResult> {
  const absRoot = path.resolve(projectPath);
  const config = resolveTestConfig(absRoot, testFiles);

  if (config.type === 'none') {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      rawOutput: 'No test records detected in active project.',
      commandUsed: 'none',
      workingDirectory: absRoot,
      executionStatus: 'no_tests_found',
      statusMessage: 'No test records detected in active project.',
    };
  }

  if (config.type === 'unsupported') {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: [],
      rawOutput: `Detected ${config.testFiles.length} test file(s) in project, but no executable test runner script is configured.`,
      commandUsed: 'none',
      workingDirectory: config.cwd,
      executionStatus: 'unable_to_execute',
      statusMessage: 'Tests detected but unable to execute',
    };
  }

  const isWindows = process.platform === 'win32';
  const nodeBin = process.execPath;

  // ── Node.js / npm test execution ────────────────────────────────────
  if (config.type === 'node-test' || config.type === 'npm-test') {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      // On Windows invoke cmd.exe /c npm test to safely resolve npm binary and shell scripts
      const proc = isWindows
        ? spawn('cmd.exe', ['/c', 'npm', 'test'], {
            cwd: config.cwd,
            windowsHide: true,
            env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
          })
        : spawn('npm', ['test'], {
            cwd: config.cwd,
            env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
          });

      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch {}
      }, 45_000);

      proc.on('close', () => {
        clearTimeout(timeout);
        const rawOutput = (stdout + '\n' + stderr).trim().slice(0, 12000);
        const defaultFile = config.testFiles[0] ?? 'test';
        const parsed = parseNodeTestOutput(rawOutput, absRoot, config.cwd, config.commandUsed, defaultFile);
        if (parsed.duration === 0) {
          parsed.duration = Date.now() - startTime;
        }
        resolve(parsed);
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: Date.now() - startTime,
          tests: [],
          rawOutput: `Failed to execute npm test: ${err.message}`,
          commandUsed: config.commandUsed,
          workingDirectory: config.cwd,
          executionStatus: 'unable_to_execute',
          statusMessage: 'Tests detected but unable to execute',
        });
      });
    });
  }

  // ── Jest / Vitest execution ─────────────────────────────────────────
  const jsonOutputPath = path.join(config.cwd, '.vectra-jest-results.json');

  function resolveRunnerScript(name: string): string {
    const fallbackPaths = [
      config.cwd,
      absRoot,
      path.resolve(__dirname, '../../../sample-app'),
      path.resolve(__dirname, '../../..'),
    ];
    try {
      return require.resolve(`${name}/bin/${name}`, { paths: fallbackPaths });
    } catch {
      for (const p of fallbackPaths) {
        const binPath = path.join(p, 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);
        if (fs.existsSync(binPath)) return binPath;
      }
      return path.join(config.cwd, 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);
    }
  }

  const jestScript = resolveRunnerScript('jest');
  const vitestScript = resolveRunnerScript('vitest');
  const runnerScript = config.type === 'jest' ? jestScript : vitestScript;
  const outputFileArg = `--outputFile=${jsonOutputPath}`;

  const args = config.type === 'jest'
    ? [runnerScript, '--json', '--outputFile', jsonOutputPath, '--forceExit']
    : [runnerScript, 'run', '--reporter=json', '--outputFile', jsonOutputPath];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const nodePathEnv = [
      path.join(config.cwd, 'node_modules'),
      path.join(absRoot, 'node_modules'),
      path.resolve(__dirname, '../../../sample-app/node_modules'),
    ].filter(p => fs.existsSync(p)).join(path.delimiter);

    const proc = spawn(nodeBin, args, {
      cwd: config.cwd,
      shell: false,
      env: {
        ...process.env,
        CI: 'true',
        FORCE_COLOR: '0',
        NODE_PATH: nodePathEnv || undefined,
      },
    });

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch {}
    }, 60_000);

    proc.on('close', () => {
      clearTimeout(timeout);
      const rawOutput = (stdout + stderr).slice(0, 8000);

      // 1. Try JSON file first
      if (fs.existsSync(jsonOutputPath)) {
        try {
          const jsonStr = fs.readFileSync(jsonOutputPath, 'utf-8');
          try { fs.unlinkSync(jsonOutputPath); } catch {}
          resolve(parseJestOutput(absRoot, jsonStr, config.cwd, config.commandUsed));
          return;
        } catch {}
      }

      // 2. Try inline JSON
      const jsonMatch = stdout.match(/(\{[\s\S]*"testResults"[\s\S]*\})/);
      if (jsonMatch) {
        resolve(parseJestOutput(absRoot, jsonMatch[1], config.cwd, config.commandUsed));
        return;
      }

      // 3. Last resort: parse text output
      const textParsed = parseJestTextOutput(stdout + stderr);
      const passed = textParsed.passed ?? 0;
      const failed = textParsed.failed ?? 0;
      const total = textParsed.total ?? (passed + failed);

      resolve({
        total,
        passed,
        failed,
        skipped: textParsed.skipped ?? 0,
        duration: textParsed.duration ?? 0,
        tests: [],
        rawOutput,
        commandUsed: config.commandUsed,
        workingDirectory: config.cwd,
        analysisRoot: absRoot,
        testWorkingDirectory: config.cwd,
        executionStatus: failed > 0 ? 'failed' : 'passed',
        statusMessage: `${passed} passed, ${failed} failed (${total} total)`,
      });
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      resolve({
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        rawOutput: 'Unable to launch test runner process',
        commandUsed: config.commandUsed,
        workingDirectory: config.cwd,
        analysisRoot: absRoot,
        testWorkingDirectory: config.cwd,
        executionStatus: 'unable_to_execute',
        statusMessage: 'Tests detected but unable to execute',
      });
    });
  });
}
