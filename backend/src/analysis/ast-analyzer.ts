import path from 'path';
import { Project, SyntaxKind, Node, FunctionDeclaration, ArrowFunction, FunctionExpression, MethodDeclaration } from 'ts-morph';
import type { Finding } from '../types';
import { nanoid, deterministicFindingId } from '../utils/nanoid';

// ── Helpers ───────────────────────────────────────────────────────────

function relPath(projectPath: string, absPath: string): string {
  return path.relative(projectPath, absPath).replace(/\\/g, '/');
}

type AnyFn = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration;

function isAsyncFn(node: AnyFn): boolean {
  return node.isAsync();
}

// ── Check 1: Functions with too many responsibilities (line count) ────

function checkComplexFunctions(projectPath: string, sourceFiles: ReturnType<Project['getSourceFiles']>): Finding[] {
  const findings: Finding[] = [];
  const COMPLEXITY_THRESHOLD = 40; // lines

  for (const sf of sourceFiles) {
    const fns: AnyFn[] = [
      ...sf.getFunctions(),
      ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    for (const fn of fns) {
      const start = fn.getStartLineNumber();
      const end = fn.getEndLineNumber();
      const lineCount = end - start;
      if (lineCount < COMPLEXITY_THRESHOLD) continue;

      const name = fn.getKind() === SyntaxKind.FunctionDeclaration
        ? (fn as FunctionDeclaration).getName() ?? '<anonymous>'
        : '<anonymous>';

      findings.push({
        id: deterministicFindingId('vectra/function-too-long', relPath(projectPath, sf.getFilePath()), start, name),
        category: 'quality',
        severity: 'low',
        title: `Function "${name}" is ${lineCount} lines long — consider splitting`,
        description: 'Large functions with mixed responsibilities are harder to test and maintain.',
        file: relPath(projectPath, sf.getFilePath()),
        line: start,
        ruleId: 'vectra/function-too-long',
        evidence: fn.getText().split('\n').slice(0, 3).join('\n').trim(),
      });
    }
  }
  return findings;
}

// ── Check 2: Variables assigned but never read (dead assignments) ─────

function checkDeadExports(projectPath: string, sourceFiles: ReturnType<Project['getSourceFiles']>): Finding[] {
  const findings: Finding[] = [];

  for (const sf of sourceFiles) {
    // Look for module.exports.X = something where X is also declared locally but only assigned once
    const varDecls = sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    for (const decl of varDecls) {
      const nameNode = decl.getNameNode();
      if (nameNode.getKind() !== SyntaxKind.Identifier) continue;
      const identNode = nameNode.asKindOrThrow(SyntaxKind.Identifier);
      const name = identNode.getText();
      const refs = identNode.findReferences();
      // Count non-definition references
      const usageCount = refs
        .flatMap(r => r.getReferences())
        .filter((r: import('ts-morph').ReferencedSymbolEntry) => !r.isDefinition())
        .length;

      if (usageCount === 0) {
        const init = decl.getInitializer();
        // Only flag if initializer is a function — unused function declarations are quality issues
        if (init && (init.getKind() === SyntaxKind.FunctionExpression || init.getKind() === SyntaxKind.ArrowFunction)) {
          findings.push({
            id: deterministicFindingId('vectra/dead-code', relPath(projectPath, sf.getFilePath()), decl.getStartLineNumber(), name),
            category: 'quality',
            severity: 'low',
            title: `Function "${name}" is declared but never used`,
            description: 'Dead code — this function is never called and can be removed.',
            file: relPath(projectPath, sf.getFilePath()),
            line: decl.getStartLineNumber(),
            ruleId: 'vectra/dead-code',
            evidence: decl.getText().split('\n')[0].trim(),
          });
        }
      }
    }
  }
  return findings;
}

// ── Check 3: Async functions that don't have proper error boundaries ──

function checkAsyncErrorHandling(projectPath: string, sourceFiles: ReturnType<Project['getSourceFiles']>): Finding[] {
  const findings: Finding[] = [];

  for (const sf of sourceFiles) {
    const fns: AnyFn[] = [
      ...sf.getFunctions(),
      ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    for (const fn of fns) {
      if (!isAsyncFn(fn)) continue;

      // Check if function body has any try/catch
      const hasTryCatch = fn.getDescendantsOfKind(SyntaxKind.TryStatement).length > 0;
      if (hasTryCatch) continue;

      // Count await expressions — functions with awaits but no try/catch are risky
      const awaitCount = fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).length;
      if (awaitCount < 2) continue; // single-await functions are lower risk

      const name = fn.getKind() === SyntaxKind.FunctionDeclaration
        ? (fn as FunctionDeclaration).getName() ?? '<anonymous>'
        : '<anonymous>';

      findings.push({
        id: deterministicFindingId('vectra/async-no-error-boundary', relPath(projectPath, sf.getFilePath()), fn.getStartLineNumber(), name),
        category: 'async',
        severity: 'medium',
        title: `Async function "${name}" has ${awaitCount} awaits but no try/catch`,
        description: 'Unhandled rejections in async functions can crash the process or silently fail.',
        file: relPath(projectPath, sf.getFilePath()),
        line: fn.getStartLineNumber(),
        ruleId: 'vectra/async-no-error-boundary',
        evidence: fn.getText().split('\n').slice(0, 2).join(' ').trim(),
      });
    }
  }
  return findings;
}

// ── Check 4: Null/undefined access without guards ────────────────────

function checkNullDereference(projectPath: string, sourceFiles: ReturnType<Project['getSourceFiles']>): Finding[] {
  const findings: Finding[] = [];

  for (const sf of sourceFiles) {
    // Find property accesses: `x.y` where x comes from a function call that may return null
    const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);

    for (const access of propAccesses) {
      const obj = access.getExpression();
      // Only flag when obj is directly from an await call (common null-return pattern)
      const parent = access.getParent();
      if (!parent) continue;

      // Look for patterns like: const x = await fn(); \n if (x.property)
      // We detect: AwaitExpression result accessed without null check in same block
      const grandParent = parent?.getParent();
      if (!grandParent) continue;

      // Check if the object expression is an Identifier used in a standalone if check
      if (obj.getKind() === SyntaxKind.Identifier) {
        const objName = obj.getText();
        // Look backwards in the block for an await assignment to this identifier
        const block = access.getFirstAncestorByKind(SyntaxKind.Block);
        if (!block) continue;

        const stmts = block.getStatements();
        const accessStmtIdx = stmts.findIndex(s => s.getStart() <= access.getStart() && s.getEnd() >= access.getEnd());
        if (accessStmtIdx <= 0) continue;

        // Check prior statements for `const/let X = await someCall()`
        for (let i = 0; i < accessStmtIdx; i++) {
          const stmt = stmts[i];
          if (stmt.getKind() !== SyntaxKind.VariableStatement) continue;
          const varStmt = stmt.asKindOrThrow(SyntaxKind.VariableStatement);
          for (const decl of varStmt.getDeclarationList().getDeclarations()) {
            if (decl.getName() !== objName) continue;
            const init = decl.getInitializer();
            if (!init || init.getKind() !== SyntaxKind.AwaitExpression) continue;

            // Found: objName = await someCall(). Now check if there's a null guard between that and this access.
            let hasNullCheck = false;
            for (let j = i + 1; j < accessStmtIdx; j++) {
              const between = stmts[j].getText();
              if (
                between.includes(`!${objName}`) ||
                between.includes(`${objName} === null`) ||
                between.includes(`${objName} == null`) ||
                between.includes(`${objName} !== null`) ||
                between.includes(`if (${objName})`)
              ) {
                hasNullCheck = true;
                break;
              }
            }

            // Skip known safe/false-positive patterns
            const accessedProp = access.getName();
            const safeProps = ['rows', 'status', 'headers', 'body', 'params', 'query', 'json', 'send'];
            if (safeProps.includes(accessedProp)) continue;

            if (!hasNullCheck) {
              findings.push({
                id: deterministicFindingId('vectra/null-deref', relPath(projectPath, sf.getFilePath()), access.getStartLineNumber(), `${objName}.${accessedProp}`),
                category: 'bug',
                severity: 'high',
                title: `Potential null dereference: "${objName}.${accessedProp}" without null check`,
                description: `"${objName}" comes from an await expression that may return null/undefined. Access ".${accessedProp}" without a null guard will throw TypeError.`,
                file: relPath(projectPath, sf.getFilePath()),
                line: access.getStartLineNumber(),
                ruleId: 'vectra/null-deref',
                evidence: access.getParent()?.getText()?.split('\n')[0]?.trim() ?? access.getText(),
              });
            }
          }
        }
      }
    }
  }
  return findings;
}

// ── Main entry ────────────────────────────────────────────────────────

export function runAstAnalysis(projectPath: string, sourceFiles: string[]): Finding[] {
  if (sourceFiles.length === 0) return [];

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      strict: false,
      noEmit: true,
    },
  });

  // Add only the target source files (not node_modules)
  const absSrcFiles = sourceFiles.map(f => path.join(projectPath, f));
  for (const f of absSrcFiles) {
    try {
      project.addSourceFileAtPath(f);
    } catch {
      // skip unreadable files
    }
  }

  const sfs = project.getSourceFiles();
  const findings: Finding[] = [
    ...checkComplexFunctions(projectPath, sfs),
    ...checkDeadExports(projectPath, sfs),
    ...checkAsyncErrorHandling(projectPath, sfs),
    ...checkNullDereference(projectPath, sfs),
  ];

  return findings;
}
