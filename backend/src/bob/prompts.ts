/**
 * Bob prompt templates for VECTRA repair and review workflows.
 *
 * Prompts are designed to produce structured, parseable output.
 * Each prompt explicitly constrains Bob's scope to avoid unnecessary file modifications.
 */

import type { Finding, ImpactMap } from '../types';

// ── Repair Plan Prompt ────────────────────────────────────────────────

export function buildRepairPlanPrompt(
  finding: Finding,
  impactMap: ImpactMap,
  fileContents: Record<string, string>,
): string {
  const fileSection = Object.entries(fileContents)
    .map(([f, src]) => `### ${f}\n\`\`\`javascript\n${src}\n\`\`\``)
    .join('\n\n');

  return `You are a precise software engineer performing a targeted code repair.

## Finding to Fix

- **ID**: ${finding.id}
- **Severity**: ${finding.severity}
- **Category**: ${finding.category}
- **Title**: ${finding.title}
- **File**: ${finding.file}
- **Line**: ${finding.line}
- **Evidence**: \`${finding.evidence ?? 'N/A'}\`
- **Rule**: ${finding.ruleId ?? 'N/A'}

## Impact Context

- **Symbol**: ${impactMap.symbolName ?? 'unknown'}
- **Containing function**: ${impactMap.containingFunction ?? 'module scope'}
- **Affected files**: ${impactMap.affectedFiles.join(', ')}
- **Related tests**: ${impactMap.relatedTests.join(', ') || 'none'}

## Source Files

${fileSection}

## Instructions

1. Produce a structured repair plan in the EXACT format below.
2. Do NOT modify any files yet — plan only.
3. Keep changes minimal and targeted. Do not refactor unrelated code.
4. Each step must reference the exact file and line range to change.

## Required Output Format

\`\`\`json
{
  "summary": "<one-sentence description of the fix>",
  "estimatedRisk": "low|medium|high",
  "steps": [
    {
      "order": 1,
      "file": "<relative file path>",
      "type": "edit|add|delete|rename",
      "description": "<what to change and why>"
    }
  ]
}
\`\`\`

Respond with ONLY the JSON block above. No explanation outside the code fence.`;
}

// ── Repair Implementation Prompt ──────────────────────────────────────

export function buildRepairImplPrompt(
  finding: Finding,
  repairPlanJson: string,
  fileContents: Record<string, string>,
): string {
  const fileSection = Object.entries(fileContents)
    .map(([f, src]) => `### ${f}\n\`\`\`javascript\n${src}\n\`\`\``)
    .join('\n\n');

  return `You are a precise software engineer implementing an approved repair plan.

## Finding

- **File**: ${finding.file}  **Line**: ${finding.line}
- **Title**: ${finding.title}
- **Evidence**: \`${finding.evidence ?? 'N/A'}\`

## Approved Repair Plan

\`\`\`json
${repairPlanJson}
\`\`\`

## Current File Contents

${fileSection}

## Instructions

1. Implement EXACTLY the steps in the repair plan above. Nothing more.
2. CRITICAL: You MUST use your file editing tools to directly modify the file(s) on disk in the workspace. Do NOT simply output code in markdown or describe the edit. The actual file on disk MUST be changed.
3. Make only the minimal changes required to fix the identified issue.
4. Do NOT refactor, rename, or modify code unrelated to this finding.
5. Do NOT add comments beyond what is needed to explain the fix.
6. After editing, confirm each changed file with a brief summary.

Implement the repair now.`;
}

// ── Independent Review Prompt ─────────────────────────────────────────

export function buildReviewPrompt(
  finding: Finding,
  repairPlanJson: string,
  changedFiles: Record<string, { before: string; after: string }>,
): string {
  const diffSection = Object.entries(changedFiles)
    .map(([f, { before, after }]) =>
      `### ${f}\n**Before:**\n\`\`\`javascript\n${before}\n\`\`\`\n\n**After:**\n\`\`\`javascript\n${after}\n\`\`\``
    )
    .join('\n\n');

  return `You are an independent code reviewer. You did NOT write this repair. Review it critically.

## Original Finding

- **Title**: ${finding.title}
- **File**: ${finding.file}  **Line**: ${finding.line}
- **Severity**: ${finding.severity}  **Category**: ${finding.category}

## Repair Plan That Was Applied

\`\`\`json
${repairPlanJson}
\`\`\`

## Changes Made

${diffSection}

## Review Criteria

Check for ALL of the following:
1. Does the fix actually address the stated finding?
2. Does it introduce any regressions or new bugs?
3. Does it introduce any security concerns?
4. Are there edge cases the fix does not handle?
5. Are there any unnecessary or unrelated changes?

## Required Output Format

\`\`\`json
{
  "status": "approved|concerns|blocked",
  "summary": "<one-sentence overall verdict>",
  "concerns": [
    {
      "severity": "critical|high|medium|low|info",
      "description": "<specific concern>",
      "file": "<file if applicable>",
      "line": <line number if applicable>
    }
  ]
}
\`\`\`

Respond with ONLY the JSON block above. No explanation outside the code fence.`;
}
