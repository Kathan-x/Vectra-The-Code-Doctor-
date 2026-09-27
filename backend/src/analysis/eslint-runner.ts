import path from 'path';
import { ESLint, Rule } from 'eslint';
// eslint-plugin-security is loaded via require to avoid ESM/CJS interop issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const securityPlugin = require('eslint-plugin-security') as ESLint.Plugin;
import type { Finding, FindingCategory, Severity } from '../types';
import { nanoid, deterministicFindingId } from '../utils/nanoid';

// ── Severity mapping from ESLint severity numbers ────────────────────

function eslintSeverity(sev: number, ruleId: string): Severity {
  // Promote certain rules regardless of configured severity
  const criticalRules = new Set([
    'no-eval', 'security/detect-eval-with-expression',
    'security/detect-non-literal-regexp',
    'security/detect-sql-injection',
    'security/detect-possible-timing-attacks',
    'vectra/no-sql-concat',
  ]);
  const highRules = new Set([
    'security/detect-object-injection',
    'security/detect-non-literal-fs-filename',
    'no-unused-vars',
    'no-undef',
  ]);

  if (criticalRules.has(ruleId)) return 'critical';
  if (highRules.has(ruleId)) return 'high';
  if (sev === 2) return 'high';
  if (sev === 1) return 'medium';
  return 'info';
}

function ruleCategory(ruleId: string): FindingCategory {
  if (ruleId.startsWith('security/')) return 'security';
  if (['no-unused-vars', 'no-unreachable', 'no-empty'].includes(ruleId)) return 'quality';
  return 'bug';
}

// ── Custom AST-level checks run inside ESLint via a rule plugin ──────
// These catch patterns ESLint core and eslint-plugin-security miss.

const CUSTOM_RULES: Record<string, Rule.RuleModule> = {
  /**
   * Detect string-concatenation SQL queries: db.query("... '" + variable + "'")
   * Catches BUG-001 (SQL injection via concatenation).
   */
  'no-sql-concat': {
    meta: { type: 'problem', schema: [] },
    create(context) {
      return {
        CallExpression(node) {
          // Match db.query(stringWithConcat)
          const callee = node.callee;
          if (callee.type !== 'MemberExpression') return;
          const prop = callee.property;
          if (prop.type !== 'Identifier' || prop.name !== 'query') return;
          const firstArg = node.arguments[0];
          if (!firstArg) return;
          // Look for BinaryExpression with + operator containing a string literal
          function hasConcatWithIdentifier(n: unknown): boolean {
            const expr = n as { type: string; operator?: string; left?: unknown; right?: unknown };
            if (expr.type === 'BinaryExpression' && expr.operator === '+') {
              const left = expr.left as { type: string };
              const right = expr.right as { type: string };
              if (left.type === 'Identifier' || right.type === 'Identifier' ||
                  left.type === 'MemberExpression' || right.type === 'MemberExpression') {
                return true;
              }
              return hasConcatWithIdentifier(expr.left) || hasConcatWithIdentifier(expr.right);
            }
            return false;
          }
          if (hasConcatWithIdentifier(firstArg)) {
            context.report({
              node: firstArg,
              message: 'SQL query built via string concatenation — potential SQL injection. Use parameterised queries.',
            });
          }
        },
      };
    },
  },

  /**
   * Detect hardcoded secrets: assignments where property name looks like a secret
   * and value is a string literal. Catches SEC-001/SEC-002.
   */
  'no-hardcoded-secret': {
    meta: { type: 'problem', schema: [] },
    create(context) {
      const SECRET_KEYS = /(?:^secret$|^password$|^passwd$|apikey|api_key|^jwtSecret$|private_?key|jwt_secret)/i;
      // Patterns that look like secrets but are actually hashes/placeholders
      const HASH_PATTERN = /^\$2[aby]\$|^sha\d+:|^[0-9a-f]{32,}$/i;
      return {
        Property(node) {
          const key = node.key as { type: string; name?: string; value?: string };
          const val = node.value as { type: string; value?: unknown };
          const keyName = key.type === 'Identifier' ? key.name : key.value;
          if (
            typeof keyName === 'string' &&
            SECRET_KEYS.test(keyName) &&
            val.type === 'Literal' &&
            typeof val.value === 'string' &&
            val.value.length > 4 &&
            !HASH_PATTERN.test(val.value) // skip bcrypt hashes / hex digests
          ) {
            context.report({
              node,
              message: `Hardcoded secret in property "${keyName}". Load from environment variable instead.`,
            });
          }
        },
      };
    },
  },

  /**
   * Detect assignment-instead-of-comparison in if conditions: if (x = value)
   * Catches BUG-003 (auth bypass).
   */
  'no-assign-in-condition': {
    meta: { type: 'problem', schema: [] },
    create(context) {
      return {
        IfStatement(node) {
          const test = node.test as { type: string; operator?: string; left?: { type: string; name?: string } };
          if (
            test.type === 'AssignmentExpression' &&
            test.operator === '='
          ) {
            const left = test.left as { type: string; name?: string };
            context.report({
              node: node.test,
              message: `Assignment (=) used as condition — did you mean comparison (!== / ===)? Variable: "${left.name ?? '?'}"`,
            });
          }
        },
      };
    },
  },

  /**
   * Detect unawaited async calls: calling an async function without await.
   * Catches BUG-006 (fire-and-forget async).
   */
  'no-floating-async': {
    meta: { type: 'problem', schema: [] },
    create(context) {
      const asyncFns = new Set<string>();
      return {
        // Collect async function declarations / expressions
        'FunctionDeclaration[async=true]'(node: unknown) {
          const n = node as { id?: { name?: string } };
          if (n.id?.name) asyncFns.add(n.id.name);
        },
        'VariableDeclarator[init.async=true]'(node: unknown) {
          const n = node as { id?: { name?: string } };
          if (n.id?.name) asyncFns.add(n.id.name);
        },
        // Check expression statements that call known async functions without await
        ExpressionStatement(node: unknown) {
          const n = node as { expression: { type: string; callee?: { type: string; name?: string; property?: { name?: string } } } };
          const expr = n.expression;
          if (expr.type !== 'CallExpression') return;
          const callee = expr.callee;
          if (!callee) return;
          let fnName: string | undefined;
          if (callee.type === 'Identifier') fnName = callee.name;
          else if (callee.type === 'MemberExpression') fnName = callee.property?.name;
          if (fnName && asyncFns.has(fnName)) {
            context.report({
              node: node as import('eslint').Rule.Node,
              message: `Async function "${fnName}" called without await — errors will be silently ignored.`,
            });
          }
        },
      };
    },
  },
};

// ── Main runner ───────────────────────────────────────────────────────

export async function runEslint(
  projectPath: string,
  sourceFiles: string[],
): Promise<Finding[]> {
  const absSrcFiles = sourceFiles
    .filter(f => /\.[cm]?[jt]sx?$/.test(f))
    .map(f => path.join(projectPath, f));
  if (absSrcFiles.length === 0) return [];

  const eslint = new ESLint({
    cwd: projectPath,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.ts'],
        plugins: {
          security: securityPlugin,
          vectra: { rules: CUSTOM_RULES },
        },
        rules: {
          // Core rules
          'no-unused-vars': 'warn',
          'no-undef': 'error',
          'no-unreachable': 'error',
          'no-empty': 'warn',
          'eqeqeq': 'warn',
          'no-eval': 'error',
          'no-implied-eval': 'error',
          // Security plugin
          'security/detect-non-literal-regexp': 'warn',
          'security/detect-non-literal-fs-filename': 'warn',
          'security/detect-object-injection': 'warn',
          'security/detect-possible-timing-attacks': 'warn',
          // Custom VECTRA rules
          'vectra/no-sql-concat': 'error',
          'vectra/no-hardcoded-secret': 'error',
          'vectra/no-assign-in-condition': 'error',
          'vectra/no-floating-async': 'error',
        },
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'commonjs',
          globals: {
            require: 'readonly',
            module: 'writable',
            exports: 'writable',
            __dirname: 'readonly',
            __filename: 'readonly',
            process: 'readonly',
            console: 'readonly',
            setTimeout: 'readonly',
            clearTimeout: 'readonly',
            Buffer: 'readonly',
          },
        },
      },
    ],
    errorOnUnmatchedPattern: false,
  });

  let results: ESLint.LintResult[];
  try {
    results = await eslint.lintFiles(absSrcFiles);
  } catch (err) {
    console.error('[eslint-runner] ESLint error:', (err as Error).message);
    return [];
  }

  const findings: Finding[] = [];

  for (const result of results) {
    const relFile = path.relative(projectPath, result.filePath).replace(/\\/g, '/');
    // Read source for evidence snippets
    let lines: string[] = [];
    try {
      lines = (result.source ?? '').split('\n');
    } catch { /* skip */ }

    for (const msg of result.messages) {
      if (!msg.ruleId) continue; // skip parser errors
      const lineIdx = (msg.line ?? 1) - 1;
      const evidence = lines[lineIdx]?.trim() ?? '';

      findings.push({
        id: deterministicFindingId(msg.ruleId, relFile, msg.line, msg.message),
        category: ruleCategory(msg.ruleId),
        severity: eslintSeverity(msg.severity, msg.ruleId),
        title: msg.message,
        description: `ESLint rule: ${msg.ruleId}`,
        file: relFile,
        line: msg.line ?? 1,
        column: msg.column,
        ruleId: msg.ruleId,
        evidence,
      });
    }
  }

  return findings;
}
