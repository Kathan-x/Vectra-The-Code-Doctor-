/**
 * VECTRA Impact Tracer
 *
 * Given a Finding (file + line + ruleId), this module:
 * 1. Loads the source file into ts-morph and locates the containing function/symbol.
 * 2. Finds all callers of that function across the project (who calls the affected code).
 * 3. Finds all callees of that function (what the affected code depends on).
 * 4. Identifies which test files exercise the affected file (by import analysis).
 * 5. Produces an ImpactMap with confidence annotations.
 *
 * Confidence levels:
 *   high   — symbol found, caller/callee relationships confirmed via AST reference analysis
 *   medium — symbol found but some relationships inferred from import/require patterns
 *   low    — symbol not found; relationships inferred at file level only
 *
 * Max traversal depth: 3 hops (configurable). Stops at node_modules boundary.
 */

import path from 'path';
import fs from 'fs';
import {
  Project,
  SyntaxKind,
  Node,
  SourceFile,
  FunctionDeclaration,
  ArrowFunction,
  FunctionExpression,
  MethodDeclaration,
  VariableDeclaration,
  ReferencedSymbol,
} from 'ts-morph';
import type { Finding, ImpactMap } from '../types';

const MAX_DEPTH = 3;
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

// ── Project-level ts-morph project (cached per projectPath) ───────────

const projectCache = new Map<string, Project>();

function getTsMorphProject(projectPath: string): Project {
  if (projectCache.has(projectPath)) return projectCache.get(projectPath)!;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: false,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      strict: false,
      noEmit: true,
      resolveJsonModule: false,
    },
  });

  // Add all JS/TS source files (exclude node_modules)
  const sourceFiles = collectSourceFiles(projectPath);
  for (const f of sourceFiles) {
    try { project.addSourceFileAtPath(f); } catch { /* skip unreadable */ }
  }

  projectCache.set(projectPath, project);
  return project;
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return files; }

  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectSourceFiles(full, files);
    else if (/\.[jt]sx?$/.test(e.name)) files.push(full);
  }
  return files;
}

// ── Symbol location helpers ───────────────────────────────────────────

type AnyFn = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration;

/**
 * Find the innermost function node that contains the given line.
 */
function findContainingFunction(sf: SourceFile, line: number): AnyFn | undefined {
  const candidates: AnyFn[] = [
    ...sf.getFunctions(),
    ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sf.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ];

  // Find the narrowest (innermost) function that contains the line
  let best: AnyFn | undefined;
  let bestSize = Infinity;

  for (const fn of candidates) {
    const start = fn.getStartLineNumber();
    const end = fn.getEndLineNumber();
    if (line >= start && line <= end) {
      const size = end - start;
      if (size < bestSize) {
        bestSize = size;
        best = fn;
      }
    }
  }
  return best;
}

/**
 * Get the name of a function node.
 */
function getFunctionName(fn: AnyFn): string | undefined {
  if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
    return (fn as FunctionDeclaration).getName() ?? undefined;
  }
  if (fn.getKind() === SyntaxKind.MethodDeclaration) {
    return (fn as MethodDeclaration).getName();
  }
  // For arrow/expression: look at parent VariableDeclarator
  const parent = fn.getParent();
  if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
    return (parent as VariableDeclaration).getName();
  }
  if (parent?.getKind() === SyntaxKind.PropertyAssignment) {
    const key = (parent as Node).getChildAtIndex(0);
    return key?.getText();
  }
  return undefined;
}

// ── Reference finding ─────────────────────────────────────────────────

/**
 * Find all call sites that reference the given function across the project.
 * Returns references grouped by file, excluding the definition itself.
 */
function findCallers(
  fn: AnyFn,
  projectPath: string,
): Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }> {
  const callers: Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }> = [];
  const fnName = getFunctionName(fn);
  if (!fnName) return callers;

  const defFile = fn.getSourceFile().getFilePath();

  // Use ts-morph's findReferences to get cross-file references
  let refs: ReferencedSymbol[] = [];
  try {
    if (fn.getKind() === SyntaxKind.FunctionDeclaration) {
      refs = (fn as FunctionDeclaration).findReferences();
    } else if (fn.getKind() === SyntaxKind.MethodDeclaration) {
      refs = (fn as MethodDeclaration).findReferences();
    } else {
      // For arrow/expression: find via parent identifier
      const parent = fn.getParent();
      if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
        const nameNode = (parent as VariableDeclaration).getNameNode();
        if (nameNode.getKind() === SyntaxKind.Identifier) {
          refs = nameNode.asKindOrThrow(SyntaxKind.Identifier).findReferences();
        }
      }
    }
  } catch {
    return callers; // ts-morph may fail on some JS patterns — return empty
  }

  for (const refGroup of refs) {
    for (const ref of refGroup.getReferences()) {
      if (ref.isDefinition()) continue; // skip the definition itself

      const refFile = ref.getSourceFile().getFilePath();
      if (refFile === defFile && ref.getNode().getStartLineNumber() === fn.getStartLineNumber()) continue;

      // Verify this is actually a call site (not just a reference)
      const refNode = ref.getNode();
      const parent = refNode.getParent();
      const isCallSite = parent?.getKind() === SyntaxKind.CallExpression ||
        parent?.getParent()?.getKind() === SyntaxKind.CallExpression ||
        parent?.getKind() === SyntaxKind.ExpressionStatement;

      const relFile = path.relative(projectPath, refFile).replace(/\\/g, '/');
      callers.push({
        file: relFile,
        line: ref.getNode().getStartLineNumber(),
        name: fnName,
        relationship: isCallSite ? 'direct' : 'inferred',
      });
    }
  }

  return callers;
}

/**
 * Find all functions called BY the given function (callees).
 * Depth-limited to 1 hop to avoid exponential expansion.
 */
function findCallees(
  fn: AnyFn,
  projectPath: string,
): Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }> {
  const callees: Array<{ file: string; line: number; name: string; relationship: 'direct' | 'inferred' }> = [];
  const sf = fn.getSourceFile();
  const filePath = path.relative(projectPath, sf.getFilePath()).replace(/\\/g, '/');

  // Find all CallExpression nodes inside this function
  const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
  const seen = new Set<string>();

  for (const call of calls) {
    const callee = call.getExpression();
    let calleeName: string | undefined;

    if (callee.getKind() === SyntaxKind.Identifier) {
      calleeName = callee.getText();
    } else if (callee.getKind() === SyntaxKind.PropertyAccessExpression) {
      // e.g. db.query — use the property name
      calleeName = (callee as Node).getChildAtIndex(2)?.getText() ?? callee.getText().split('.').pop();
    }

    if (!calleeName || calleeName.length < 2) continue;
    // Skip common built-ins
    if (['console', 'JSON', 'Math', 'Object', 'Array', 'String', 'Promise'].includes(calleeName)) continue;

    const key = `${calleeName}:${call.getStartLineNumber()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    callees.push({
      file: filePath,
      line: call.getStartLineNumber(),
      name: calleeName,
      relationship: 'direct',
    });
  }

  return callees;
}

// ── Module import graph ───────────────────────────────────────────────

/**
 * Build a map of: file → files it imports (require/import).
 * Used for inferred impact when AST symbol resolution fails.
 */
function buildImportGraph(projectPath: string): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const files = collectSourceFiles(projectPath);

  for (const file of files) {
    const relFile = path.relative(projectPath, file).replace(/\\/g, '/');
    const imports = new Set<string>();

    let src: string;
    try { src = fs.readFileSync(file, 'utf-8'); }
    catch { continue; }

    // Match: require('./something') or require('../something')
    const requireMatches = src.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const m of requireMatches) {
      const resolved = resolveRelativeImport(file, m[1], projectPath);
      if (resolved) imports.add(resolved);
    }

    // Match: import ... from './something'
    const importMatches = src.matchAll(/from\s+['"]([^'"]+)['"]/g);
    for (const m of importMatches) {
      const resolved = resolveRelativeImport(file, m[1], projectPath);
      if (resolved) imports.add(resolved);
    }

    graph.set(relFile, imports);
  }

  return graph;
}

function resolveRelativeImport(fromFile: string, specifier: string, projectPath: string): string | null {
  if (!specifier.startsWith('.')) return null; // skip package imports

  const dir = path.dirname(fromFile);
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];

  for (const ext of extensions) {
    const candidate = path.resolve(dir, specifier + ext);
    if (fs.existsSync(candidate)) {
      return path.relative(projectPath, candidate).replace(/\\/g, '/');
    }
  }

  // Try without extension (exact match)
  const exact = path.resolve(dir, specifier);
  if (fs.existsSync(exact)) {
    return path.relative(projectPath, exact).replace(/\\/g, '/');
  }

  return null;
}

/**
 * Find all files that directly or transitively import the given file.
 * Depth-limited to MAX_DEPTH.
 */
function findFilesImporting(
  targetFile: string,
  importGraph: Map<string, Set<string>>,
  maxDepth = MAX_DEPTH,
): Set<string> {
  const affected = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file: targetFile, depth: 0 }];
  const visited = new Set<string>([targetFile]);

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    for (const [importer, imports] of importGraph) {
      if (imports.has(file) && !visited.has(importer)) {
        visited.add(importer);
        affected.add(importer);
        queue.push({ file: importer, depth: depth + 1 });
      }
    }
  }

  return affected;
}

// ── Test file detection ───────────────────────────────────────────────

const TEST_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /[\\/]tests?[\\/]/i];

function isTestFile(f: string): boolean {
  return TEST_PATTERNS.some(p => p.test(f));
}

/**
 * Find test files that import or reference the affected files.
 */
function findRelatedTests(
  affectedFiles: Set<string>,
  importGraph: Map<string, Set<string>>,
): string[] {
  const related = new Set<string>();

  for (const [file, imports] of importGraph) {
    if (!isTestFile(file)) continue;
    // Test file directly imports one of the affected files
    for (const affected of affectedFiles) {
      if (imports.has(affected) || file.includes(path.basename(affected, path.extname(affected)))) {
        related.add(file);
      }
    }
  }

  return Array.from(related);
}

// ── Fallback: module-name heuristic ──────────────────────────────────

/**
 * When AST resolution fails, find test files by matching the affected
 * file's base name against test file names.
 */
function findTestsByFileName(affectedFile: string, allFiles: string[]): string[] {
  const base = path.basename(affectedFile, path.extname(affectedFile));
  return allFiles
    .filter(f => isTestFile(f))
    .filter(f => f.toLowerCase().includes(base.toLowerCase()));
}

// ── Main entry point ──────────────────────────────────────────────────

export function traceImpact(
  finding: Finding,
  projectPath: string,
  cachedSourceFiles?: string[], // optional: from AnalysisSnapshot.projectInfo.sourceFiles
): ImpactMap {
  const absProjectPath = path.resolve(projectPath);
  const absFile = path.resolve(absProjectPath, finding.file);

  // Build import graph (fast, no AST needed)
  const importGraph = buildImportGraph(absProjectPath);
  const allFiles = Array.from(importGraph.keys());

  // Files that depend on the affected file
  const dependentFiles = findFilesImporting(finding.file, importGraph);
  const affectedFiles = new Set<string>([finding.file, ...dependentFiles]);

  // ── AST-level analysis ────────────────────────────────────────────

  let symbolName: string | undefined;
  let containingFunction: string | undefined;
  let callers: ImpactMap['callers'] = [];
  let callees: ImpactMap['callees'] = [];
  let confidence: ImpactMap['confidence'] = 'low';

  try {
    const project = getTsMorphProject(absProjectPath);
    const sf = project.getSourceFile(absFile);

    if (sf) {
      // Locate containing function
      const fn = findContainingFunction(sf, finding.line);

      if (fn) {
        symbolName = getFunctionName(fn);
        containingFunction = symbolName;
        confidence = 'medium'; // symbol found

        // Find callers (who calls this function)
        const rawCallers = findCallers(fn, absProjectPath);
        callers = rawCallers;

        // Find callees (what this function calls)
        callees = findCallees(fn, absProjectPath);

        // Add caller files to affected set
        for (const caller of callers) {
          affectedFiles.add(caller.file);
        }

        // Upgrade confidence if we got direct call-site references
        if (callers.some(c => c.relationship === 'direct')) {
          confidence = 'high';
        }
      } else {
        // No containing function — finding is at module scope
        // Still try to find who imports this file
        confidence = 'medium';
      }
    }
  } catch (err) {
    // ts-morph failed — fall back to import-graph analysis
    confidence = 'low';
  }

  // ── Related tests ─────────────────────────────────────────────────

  // First try: import-graph based (most accurate)
  let relatedTests = findRelatedTests(affectedFiles, importGraph);

  // Second try: file-name heuristic
  if (relatedTests.length === 0) {
    relatedTests = findTestsByFileName(finding.file, allFiles);
  }

  // ── Final assembly ────────────────────────────────────────────────

  // Sort affected files: finding's own file first, then callers, then rest
  const affectedSorted = [
    finding.file,
    ...Array.from(affectedFiles).filter(f => f !== finding.file && !isTestFile(f)),
  ].filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate

  // Depth = deepest caller chain we found
  const depth = Math.min(
    MAX_DEPTH,
    callers.length > 0 ? 2 : dependentFiles.size > 0 ? 1 : 0,
  );

  return {
    issueId: finding.id,
    symbolName,
    containingFunction,
    affectedFiles: affectedSorted,
    callers: deduplicateRefs(callers),
    callees: deduplicateRefs(callees),
    relatedTests,
    depth,
    confidence,
  };
}

function deduplicateRefs<T extends { file: string; line: number; name: string }>(refs: T[]): T[] {
  const seen = new Set<string>();
  return refs.filter(r => {
    const key = `${r.file}:${r.line}:${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
