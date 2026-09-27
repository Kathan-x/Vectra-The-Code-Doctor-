import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { readCache } from '../analysis/cache';
import { findFindingInProject } from '../analysis/finding-lookup';
import { traceImpact } from '../analysis/impact-tracer';
import type { ImpactMap, Finding } from '../types';

const router = Router();

/**
 * GET /api/impact/:issueId?projectPath=...
 *
 * Traces the blast radius of a specific finding.
 * Requires the project to have been analyzed first (cache must exist).
 *
 * Query params:
 *   projectPath  — absolute or relative path to the target project
 *
 * Returns: ImpactMap
 */
router.get('/:issueId', async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { projectPath } = req.query as { projectPath?: string };

  if (!projectPath) {
    res.status(400).json({ error: 'projectPath query param required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    res.status(400).json({ error: `Project path does not exist: ${absPath}` });
    return;
  }

  // Find the specific issue via findFindingInProject (checks report, afterSnapshot, cache, etc.)
  const { finding, snapshot } = findFindingInProject(absPath, issueId);

  if (!finding) {
    res.status(404).json({ error: `Issue ${issueId} not found` });
    return;
  }

  try {
    const impactMap = traceImpact(finding, absPath, snapshot?.projectInfo?.sourceFiles);
    res.json(impactMap);
  } catch (err) {
    console.error('[/api/impact]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/impact
 *
 * Traces impact for a finding provided directly in the request body.
 * Useful for ad-hoc traces without a cache lookup.
 *
 * Body: { projectPath: string, finding: Finding }
 */
router.post('/', async (req: Request, res: Response) => {
  const { projectPath, finding } = req.body as { projectPath?: string; finding?: Finding };

  if (!projectPath || !finding) {
    res.status(400).json({ error: 'projectPath and finding are required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    res.status(400).json({ error: `Project path does not exist: ${absPath}` });
    return;
  }

  try {
    const impactMap = traceImpact(finding, absPath);
    res.json(impactMap);
  } catch (err) {
    console.error('[/api/impact POST]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
