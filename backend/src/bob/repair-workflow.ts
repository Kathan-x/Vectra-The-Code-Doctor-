/**
 * VECTRA Repair Workflow
 *
 * Orchestrates: Finding → RepairPlan (Bob) → Approval → Implementation (Bob)
 *
 * Stages:
 *   1. planRepair()  — Bob produces a structured JSON repair plan (read-only, no file changes)
 *   2. runRepair()   — Bob implements the approved plan (writes files)
 *
 * File writes only happen in stage 2, after the developer explicitly approves.
 * All Bob interactions are isolated in bob-client.ts.
 */

import fs from 'fs';
import path from 'path';
import type { Finding, ImpactMap, RepairPlan } from '../types';
import { runBob, BobUnavailableError } from './bob-client';
import { buildRepairPlanPrompt, buildRepairImplPrompt } from './prompts';
import { nanoid } from '../utils/nanoid';

// ── Helpers ───────────────────────────────────────────────────────────

/** Read file contents for context — limits to MAX_FILE_CHARS to control token cost */
const MAX_FILE_CHARS = 4000;

function readFileForContext(projectPath: string, relFile: string): string {
  try {
    const abs = path.join(projectPath, relFile);
    const src = fs.readFileSync(abs, 'utf-8');
    return src.length > MAX_FILE_CHARS ? src.slice(0, MAX_FILE_CHARS) + '\n// ... (truncated)' : src;
  } catch {
    return '// (file unreadable)';
  }
}

function collectContextFiles(
  projectPath: string,
  finding: Finding,
  impactMap: ImpactMap,
): Record<string, string> {
  // Include the finding's own file + its direct dependents (capped at 3 files)
  const files = [finding.file, ...impactMap.affectedFiles.filter(f => f !== finding.file)].slice(0, 3);
  const result: Record<string, string> = {};
  for (const f of files) {
    result[f] = readFileForContext(projectPath, f);
  }
  return result;
}

/** Extract JSON from a Bob response that may contain markdown fences */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Fallback: find first { ... }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}

// ── Stage 1: Plan ─────────────────────────────────────────────────────

export interface PlanRepairResult {
  plan: RepairPlan;
  rawResponse: string;
}

export async function planRepair(
  finding: Finding,
  impactMap: ImpactMap,
  projectPath: string,
  onChunk?: (text: string) => void,
): Promise<PlanRepairResult> {
  const contextFiles = collectContextFiles(projectPath, finding, impactMap);
  const prompt = buildRepairPlanPrompt(finding, impactMap, contextFiles);

  const result = await runBob(prompt, {
    cwd: projectPath,
    maxTurns: 5, // planning only — very low turn limit
    onChunk,
  });

  if (!result.success) {
    throw new Error(`Bob repair plan failed: ${result.error ?? 'unknown error'}`);
  }

  // Parse structured JSON from Bob's response
  let planData: {
    summary: string;
    estimatedRisk: 'low' | 'medium' | 'high';
    steps: RepairPlan['steps'];
  };

  try {
    planData = JSON.parse(extractJson(result.text));
  } catch {
    // Bob didn't follow the JSON format — wrap as a single free-text step
    planData = {
      summary: result.text.split('\n')[0].slice(0, 200),
      estimatedRisk: 'medium',
      steps: [{ order: 1, file: finding.file, type: 'edit', description: result.text.slice(0, 500) }],
    };
  }

  const plan: RepairPlan = {
    issueId: finding.id,
    summary: planData.summary ?? 'No summary provided',
    steps: planData.steps ?? [],
    estimatedRisk: planData.estimatedRisk ?? 'medium',
    rawBobResponse: result.text,
  };

  return { plan, rawResponse: result.text };
}

// ── Stage 2: Implement ────────────────────────────────────────────────

import crypto from 'crypto';

export interface RunRepairResult {
  success: boolean;
  rawResponse: string;
  error?: string;
  modifiedFiles?: string[];
  beforeHashes?: Record<string, string>;
  afterHashes?: Record<string, string>;
}

function getFileHash(absPath: string): string | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    const buf = fs.readFileSync(absPath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

export async function runRepair(
  finding: Finding,
  plan: RepairPlan,
  projectPath: string,
  onChunk?: (text: string) => void,
): Promise<RunRepairResult> {
  const targetFiles = plan.steps.map(s => s.file);
  const beforeHashes: Record<string, string> = {};

  // 1. Pre-flight verification: verify files exist and expected context is present
  for (const relFile of targetFiles) {
    const abs = path.join(projectPath, relFile);
    if (!fs.existsSync(abs)) {
      throw new Error(`Target file for repair does not exist: ${relFile}`);
    }
    const content = fs.readFileSync(abs, 'utf-8');
    const hash = getFileHash(abs);
    if (hash) beforeHashes[relFile] = hash;

    // Verify context: if finding has evidence, ensure it is still present in the file
    if (relFile === finding.file && finding.evidence) {
      const cleanEvidence = finding.evidence.trim();
      if (cleanEvidence.length > 5 && !content.includes(cleanEvidence)) {
        throw new Error(
          `Source context has changed in ${relFile} since plan generation. The expected code line no longer matches. Please re-analyze the project.`
        );
      }
    }
  }

  const contextFiles = collectContextFiles(projectPath, finding, {
    issueId: finding.id,
    affectedFiles: targetFiles,
    callers: [],
    callees: [],
    relatedTests: [],
    depth: 0,
    confidence: 'low',
  });

  const planJson = JSON.stringify(
    { summary: plan.summary, estimatedRisk: plan.estimatedRisk, steps: plan.steps },
    null, 2
  );
  const prompt = buildRepairImplPrompt(finding, planJson, contextFiles);

  // 2. Execute Bob to apply modifications
  const result = await runBob(prompt, {
    cwd: projectPath,
    maxTurns: 15,
    onChunk,
  });

  // 3. Inspect target files on disk after Bob execution
  const afterHashes: Record<string, string> = {};
  const modifiedFiles: string[] = [];

  for (const relFile of targetFiles) {
    const abs = path.join(projectPath, relFile);
    const postHash = getFileHash(abs);
    if (postHash) {
      afterHashes[relFile] = postHash;
      if (beforeHashes[relFile] && postHash !== beforeHashes[relFile]) {
        modifiedFiles.push(relFile);
      }
    }
  }

  // 4. Fallback: If Bob did not edit the file with tools, check if Bob returned code block in response
  if (modifiedFiles.length === 0 && targetFiles.length === 1 && result.text) {
    const primaryRel = targetFiles[0];
    const primaryAbs = path.join(projectPath, primaryRel);
    // Look for ```javascript ... ``` or ```js ... ``` containing full code replacement
    const codeMatch = result.text.match(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      const candidateCode = codeMatch[1].trim();
      // Only apply if candidateCode is substantial (at least 2 lines and > 20 chars)
      if (candidateCode.split('\n').length >= 2 && candidateCode.length > 20) {
        try {
          fs.writeFileSync(primaryAbs, candidateCode, 'utf-8');
          const newHash = getFileHash(primaryAbs);
          if (newHash && newHash !== beforeHashes[primaryRel]) {
            afterHashes[primaryRel] = newHash;
            modifiedFiles.push(primaryRel);
          }
        } catch {}
      }
    }
  }

  // 5. Hard validation: Did any target file actually change on disk?
  if (modifiedFiles.length === 0) {
    return {
      success: false,
      rawResponse: result.text,
      error: 'Target file was not modified on disk. The repair did not change any code.',
      beforeHashes,
      afterHashes,
    };
  }

  return {
    success: true,
    rawResponse: result.text,
    modifiedFiles,
    beforeHashes,
    afterHashes,
    error: result.error,
  };
}
