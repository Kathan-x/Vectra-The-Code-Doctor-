/**
 * VECTRA Review Workflow
 *
 * Performs an independent Bob review pass AFTER a repair has been applied.
 * Bob is given: original finding + repair plan + before/after file diffs.
 * Bob has NOT seen the repair implementation — this is genuinely independent.
 */

import fs from 'fs';
import path from 'path';
import type { Finding, RepairPlan, ReviewResult } from '../types';
import { runBob } from './bob-client';
import { buildReviewPrompt } from './prompts';

const MAX_FILE_CHARS = 3000;

function readFile(absPath: string): string {
  try {
    const src = fs.readFileSync(absPath, 'utf-8');
    return src.length > MAX_FILE_CHARS ? src.slice(0, MAX_FILE_CHARS) + '\n// ... (truncated)' : src;
  } catch {
    return '// (unreadable)';
  }
}

/** Extract JSON from Bob's response */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}

export interface ReviewInput {
  finding: Finding;
  plan: RepairPlan;
  projectPath: string;
  /** Snapshot of file contents BEFORE the repair (pass strings, not file paths) */
  beforeSnapshots: Record<string, string>;
  onChunk?: (text: string) => void;
}

export async function runReview(input: ReviewInput): Promise<ReviewResult> {
  const { finding, plan, projectPath, beforeSnapshots, onChunk } = input;

  // Collect current (after-repair) file contents for the changed files
  const changedFiles: Record<string, { before: string; after: string }> = {};
  const changedFilePaths = plan.steps.map(s => s.file).filter((f, i, a) => a.indexOf(f) === i);

  let hasRealModifications = false;

  for (const relFile of changedFilePaths) {
    const absPath = path.join(projectPath, relFile);
    const beforeContent = beforeSnapshots[relFile] ?? '';
    const afterContent = readFile(absPath);
    if (beforeContent.trim() && afterContent.trim() && beforeContent.trim() !== afterContent.trim()) {
      hasRealModifications = true;
    }
    changedFiles[relFile] = {
      before: beforeContent || '// (no before snapshot)',
      after: afterContent,
    };
  }

  // The review must operate on the actual modification produced by Stage 2.
  // If no source file changed on disk, there is nothing legitimate to review as an applied repair.
  if (!hasRealModifications && Object.keys(beforeSnapshots).length > 0) {
    return {
      issueId: finding.id,
      status: 'blocked',
      summary: 'Review blocked: No on-disk code modification was detected for the repaired file.',
      concerns: [{
        severity: 'high',
        description: 'The target source file on disk is identical before and after repair. There are no applied modifications to review.',
      }],
      rawBobResponse: 'No file modifications detected on disk.',
    };
  }

  // Perform deterministic syntax/parse validity check on modified source files
  let syntaxValid = true;
  let syntaxError: { file: string; message: string } | null = null;

  for (const relFile of changedFilePaths) {
    if (relFile.endsWith('.js') || relFile.endsWith('.mjs') || relFile.endsWith('.cjs')) {
      const absPath = path.join(projectPath, relFile);
      try {
        const code = fs.readFileSync(absPath, 'utf-8');
        // Test compile without execution
        new Function(code);
      } catch (err) {
        syntaxValid = false;
        syntaxError = { file: relFile, message: (err as Error).message };
        break;
      }
    }
  }

  if (!syntaxValid && syntaxError) {
    return {
      issueId: finding.id,
      status: 'blocked',
      summary: `Review blocked: Syntax error detected in ${syntaxError.file}`,
      concerns: [{
        severity: 'critical',
        description: `Syntax validation failed on ${syntaxError.file}: ${syntaxError.message}`,
        file: syntaxError.file,
      }],
      changedFiles: changedFilePaths,
      syntaxValid: false,
      securityRegression: false,
      timestamp: new Date().toISOString(),
      rawBobResponse: 'Syntax error detected in modified file on disk.',
    };
  }

  const planJson = JSON.stringify(
    { summary: plan.summary, estimatedRisk: plan.estimatedRisk, steps: plan.steps },
    null, 2
  );

  const prompt = buildReviewPrompt(finding, planJson, changedFiles);

  const result = await runBob(prompt, {
    cwd: projectPath,
    maxTurns: 5, // review only — short
    onChunk,
  });

  if (!result.success) {
    // If Bob fails to produce a review, return a blocked status
    return {
      issueId: finding.id,
      status: 'blocked',
      summary: `Independent review could not complete: ${result.error ?? 'execution error'}`,
      concerns: [{
        severity: 'high',
        description: `Automated review failed to execute: ${result.error ?? 'unknown error'}. Manual inspection required.`,
      }],
      changedFiles: changedFilePaths,
      syntaxValid: true,
      securityRegression: false,
      timestamp: new Date().toISOString(),
      rawBobResponse: result.text,
    };
  }

  // Parse structured JSON
  let reviewData: {
    status: ReviewResult['status'];
    summary: string;
    concerns: ReviewResult['concerns'];
  };

  try {
    reviewData = JSON.parse(extractJson(result.text));
  } catch {
    // Free-text response — wrap as a concern
    reviewData = {
      status: 'concerns',
      summary: 'Review complete (unstructured response)',
      concerns: [{
        severity: 'info',
        description: result.text.slice(0, 500),
      }],
    };
  }

  const securityRegression = (reviewData.concerns ?? []).some(
    c => c.severity === 'critical' || c.severity === 'high'
  );

  return {
    issueId: finding.id,
    status: reviewData.status ?? (securityRegression ? 'concerns' : 'approved'),
    summary: reviewData.summary ?? '',
    concerns: reviewData.concerns ?? [],
    changedFiles: changedFilePaths,
    syntaxValid: true,
    securityRegression,
    timestamp: new Date().toISOString(),
    rawBobResponse: result.text,
  };
}
