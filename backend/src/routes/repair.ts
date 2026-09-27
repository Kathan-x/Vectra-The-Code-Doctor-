/**
 * VECTRA Repair & Review Routes
 *
 * POST /api/repair/plan    — Generate a repair plan (Bob, read-only)
 * POST /api/repair/run     — Execute the approved plan (Bob, writes files) — streams SSE
 * POST /api/repair/review  — Independent Bob review of applied changes
 * GET  /api/repair/status  — Check Bob availability without consuming tokens
 *
 * These routes NEVER forward BOB_API_KEY or any credentials to the frontend.
 * Streaming uses Server-Sent Events (text/event-stream).
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { readCache } from '../analysis/cache';
import { findFindingInProject } from '../analysis/finding-lookup';
import { getFindingFingerprint } from '../analysis/fingerprint';
import { traceImpact } from '../analysis/impact-tracer';
import { planRepair, runRepair } from '../bob/repair-workflow';
import { runReview } from '../bob/review-workflow';
import { isBobAvailable, BobUnavailableError } from '../bob/bob-client';
import type { Finding, RepairPlan, RepairRecord } from '../types';
import { loadReport, saveReport, generateReport } from '../report/report-engine';
import { analyzeProject } from '../analysis';

const router = Router();

// ── GET /api/repair/status ────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  const status = await isBobAvailable();
  res.json(status);
});

// ── POST /api/repair/plan ─────────────────────────────────────────────

router.post('/plan', async (req: Request, res: Response) => {
  const { projectPath, issueId } = req.body as { projectPath?: string; issueId?: string };

  if (!projectPath || !issueId) {
    res.status(400).json({ error: 'projectPath and issueId are required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  const { finding, snapshot } = findFindingInProject(absPath, issueId);

  if (!finding || !snapshot) {
    res.status(404).json({ error: `Issue ${issueId} not found` });
    return;
  }

  // Use SSE for streaming the plan generation
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const impactMap = traceImpact(finding, absPath, snapshot.projectInfo.sourceFiles);

    send('status', { stage: 'planning', message: 'Bob is generating a repair plan…' });

    const { plan } = await planRepair(finding, impactMap, absPath, (chunk) => {
      send('chunk', { text: chunk });
    });

    send('plan', plan);
    send('done', { success: true });
  } catch (err) {
    const msg = (err as Error).message;
    const isBobErr = err instanceof BobUnavailableError;
    send('error', { message: msg, bobUnavailable: isBobErr });
  } finally {
    res.end();
  }
});

// ── POST /api/repair/run ──────────────────────────────────────────────

router.post('/run', async (req: Request, res: Response) => {
  const { projectPath, issueId, plan } = req.body as {
    projectPath?: string;
    issueId?: string;
    plan?: RepairPlan;
  };

  if (!projectPath || !issueId || !plan) {
    res.status(400).json({ error: 'projectPath, issueId, and plan are required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  const { finding } = findFindingInProject(absPath, issueId);

  if (!finding) {
    res.status(404).json({ error: `Issue ${issueId} not found` });
    return;
  }

  // Snapshot file contents BEFORE repair (for review diff and immutable baseline)
  const beforeSnapshots: Record<string, string> = {};
  const beforeHashes: Record<string, string> = {};
  for (const step of plan.steps) {
    const absFile = path.join(absPath, step.file);
    try {
      const content = fs.readFileSync(absFile, 'utf-8');
      beforeSnapshots[step.file] = content;
      beforeHashes[step.file] = crypto.createHash('sha256').update(content).digest('hex');
      try { fs.writeFileSync(`${absFile}.orig`, content, 'utf-8'); } catch {}
    } catch {
      beforeSnapshots[step.file] = '';
      beforeHashes[step.file] = '';
    }
  }

  // SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('status', { stage: 'implementing', message: 'Bob is implementing the repair…' });

    const result = await runRepair(finding, plan, absPath, (chunk) => {
      send('chunk', { text: chunk });
    });

    if (result.success && result.modifiedFiles && result.modifiedFiles.length > 0) {
      // Calculate AFTER hashes to confirm actual modification on disk
      const afterHashes: Record<string, string> = {};
      for (const f of result.modifiedFiles) {
        const absFile = path.join(absPath, f);
        try {
          const content = fs.readFileSync(absFile, 'utf-8');
          afterHashes[f] = crypto.createHash('sha256').update(content).digest('hex');
        } catch {
          afterHashes[f] = '';
        }
      }

      // Store before-snapshots in a temp location for the review step
      const snapKey = `repair-before-${issueId}`;
      (global as Record<string, unknown>)[snapKey] = beforeSnapshots;

      // Persist the repair record into the project report immediately
      try {
        const existingReport = loadReport(absPath);
        if (existingReport) {
          const repairRecord: RepairRecord = {
            issueId,
            findingTitle: finding.title,
            findingFile: finding.file,
            findingLine: finding.line,
            findingFingerprint: getFindingFingerprint(finding),
            plan,
            appliedAt: new Date().toISOString(),
            reviewResult: null,
            beforeSnapshots,
            beforeHashes,
            afterHashes,
            modifiedFiles: result.modifiedFiles,
            workflowStage: 'review_pending',
          };
          const updatedReport = generateReport({
            snapshot: existingReport.snapshot,
            projectPath: absPath,
            existingRepairs: existingReport.repairs,
            newRepair: repairRecord,
          });
          saveReport(updatedReport);
        }
      } catch (saveErr) {
        console.warn('Failed to save repair record to report:', saveErr);
      }
    }

    send('done', {
      success: result.success,
      modifiedFiles: result.modifiedFiles,
      error: result.error,
    });
  } catch (err) {
    const msg = (err as Error).message;
    const isBobErr = err instanceof BobUnavailableError;
    send('error', { message: msg, bobUnavailable: isBobErr });
  } finally {
    res.end();
  }
});

// ── POST /api/repair/review ───────────────────────────────────────────

router.post('/review', async (req: Request, res: Response) => {
  const { projectPath, issueId, plan } = req.body as {
    projectPath?: string;
    issueId?: string;
    plan?: RepairPlan;
  };

  if (!projectPath || !issueId || !plan) {
    res.status(400).json({ error: 'projectPath, issueId, and plan are required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  const { finding } = findFindingInProject(absPath, issueId);

  if (!finding) {
    res.status(404).json({ error: `Issue ${issueId} not found` });
    return;
  }

  const existingReport = loadReport(absPath);
  const existingRepair = existingReport?.repairs.find(r => r.issueId === issueId);
  // Retrieve before-snapshots stashed in global or from persisted report or .orig backups
  const snapKey = `repair-before-${issueId}`;
  const beforeSnapshots = ((global as Record<string, unknown>)[snapKey] as Record<string, string>)
    ?? { ...(existingRepair?.beforeSnapshots ?? {}) };

  for (const step of plan.steps) {
    if (!beforeSnapshots[step.file]) {
      const origFile = path.join(absPath, `${step.file}.orig`);
      if (fs.existsSync(origFile)) {
        try { beforeSnapshots[step.file] = fs.readFileSync(origFile, 'utf-8'); } catch {}
      }
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('status', { stage: 'reviewing', message: 'Bob is performing an independent review…' });

    const reviewResult = await runReview({
      finding,
      plan,
      projectPath: absPath,
      beforeSnapshots,
      onChunk: (chunk) => send('chunk', { text: chunk }),
    });

    // Update the RepairRecord in the persisted report with the reviewResult
    try {
      const currentReport = loadReport(absPath);
      if (currentReport) {
        const repairIdx = currentReport.repairs.findIndex(r => r.issueId === issueId);
        const reviewStage = reviewResult.status === 'approved' ? 'review_passed' : 'review_failed';
        if (repairIdx >= 0) {
          currentReport.repairs[repairIdx].reviewResult = reviewResult;
          currentReport.repairs[repairIdx].workflowStage = reviewStage;
        } else {
          currentReport.repairs.push({
            issueId,
            findingTitle: finding.title,
            findingFile: finding.file,
            findingLine: finding.line,
            findingFingerprint: getFindingFingerprint(finding),
            plan,
            appliedAt: new Date().toISOString(),
            reviewResult,
            beforeSnapshots,
            workflowStage: reviewStage,
          });
        }
        const updatedReport = generateReport({
          snapshot: currentReport.snapshot,
          projectPath: absPath,
          existingRepairs: currentReport.repairs,
          afterSnapshot: currentReport.afterSnapshot,
        });
        saveReport(updatedReport);
      }
    } catch (saveErr) {
      console.warn('Failed to update review result in report:', saveErr);
    }

    send('review', reviewResult);
    send('done', { success: true });
  } catch (err) {
    const msg = (err as Error).message;
    const isBobErr = err instanceof BobUnavailableError;
    send('error', { message: msg, bobUnavailable: isBobErr });
  } finally {
    res.end();
  }
});

// ── POST /api/repair/verify ───────────────────────────────────────────

router.post('/verify', async (req: Request, res: Response) => {
  const { projectPath } = req.body as { projectPath?: string };
  if (!projectPath) {
    res.status(400).json({ error: 'projectPath is required' });
    return;
  }

  const absPath = path.resolve(projectPath);

  try {
    const existingReport = loadReport(absPath);
    let baselineSnapshot = existingReport?.snapshot ?? readCache(absPath);

    if (!baselineSnapshot) {
      const initial = await analyzeProject(absPath, true);
      baselineSnapshot = initial.snapshot;
    }

    // Run tests and full re-analysis on target project (force=true)
    const afterResult = await analyzeProject(absPath, true);
    const afterSnapshot = afterResult.snapshot;

    const existingRepairs = existingReport?.repairs ? [...existingReport.repairs] : [];

    const updatedReport = generateReport({
      snapshot: baselineSnapshot,
      projectPath: absPath,
      existingRepairs,
      afterSnapshot,
    });

    // Derive verification stage from evaluation status
    const verifyStage = updatedReport.summary.verificationStatus === 'passed' ? 'verification_passed'
      : updatedReport.summary.verificationStatus === 'partial' ? 'verification_partial'
      : 'verification_failed';

    for (const r of updatedReport.repairs) {
      if (r.appliedAt) {
        r.workflowStage = verifyStage;
      }
    }

    saveReport(updatedReport);
    res.json(updatedReport);
  } catch (err) {
    console.error('[/api/repair/verify error]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
