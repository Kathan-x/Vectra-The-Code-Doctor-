import { Router, Request, Response } from 'express';
import path from 'path';
import { readCache } from '../analysis/cache';
import { generateReport, loadReport } from '../report/report-engine';
import type { RepairRecord, AnalysisSnapshot } from '../types';

const router = Router();

// ── GET /api/report ───────────────────────────────────────────────────
// Returns the most recently persisted report for a project.

router.get('/', (req: Request, res: Response) => {
  const { projectPath } = req.query as { projectPath?: string };
  if (!projectPath) {
    res.status(400).json({ error: 'projectPath query param required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  const report = loadReport(absPath);
  if (!report) {
    const snapshot = readCache(absPath);
    if (snapshot) {
      try {
        const generated = generateReport({
          snapshot,
          projectPath: absPath,
          existingRepairs: [],
        });
        res.json(generated);
        return;
      } catch (err) {
        console.error('Auto report generation error:', err);
      }
    }
    res.status(404).json({ error: 'No report found. Run POST /api/report/generate first.' });
    return;
  }
  res.json(report);
});

// ── POST /api/report/generate ─────────────────────────────────────────
// Generates (or refreshes) the project report from available data.
// Body: { projectPath, repairRecord?, afterSnapshot? }

router.post('/generate', (req: Request, res: Response) => {
  const { projectPath, repairRecord, afterSnapshot } = req.body as {
    projectPath?: string;
    repairRecord?: RepairRecord;
    afterSnapshot?: AnalysisSnapshot;
  };

  if (!projectPath) {
    res.status(400).json({ error: 'projectPath is required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  const existing = loadReport(absPath);
  const snapshot = readCache(absPath) ?? existing?.snapshot;
  if (!snapshot) {
    res.status(404).json({
      error: 'No analysis cache. Run POST /api/analyze first.',
      status: 'NOT_ANALYZED',
    });
    return;
  }

  // Load existing repair history so we don't wipe it on re-generate
  const existingRepairs = existing?.repairs ?? [];
  // When verifying with an afterSnapshot or existing repairs, retain the true baseline snapshot
  const baselineSnapshot = ((afterSnapshot || existingRepairs.length > 0) && existing?.snapshot)
    ? existing.snapshot
    : snapshot;

  try {
    const report = generateReport({
      snapshot: baselineSnapshot,
      projectPath: absPath,
      existingRepairs,
      newRepair: repairRecord,
      afterSnapshot,
    });
    res.json(report);
  } catch (err) {
    console.error('[/api/report/generate]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
