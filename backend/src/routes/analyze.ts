import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { analyzeProject, cacheKey } from '../analysis';
import type { AnalyzeRequest, AnalyzeResponse } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { projectPath, force = false } = req.body as AnalyzeRequest;

  if (!projectPath || typeof projectPath !== 'string') {
    res.status(400).json({ error: 'projectPath is required' });
    return;
  }

  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    res.status(400).json({ error: `Project path does not exist: ${absPath}` });
    return;
  }

  try {
    const { snapshot, cacheHit } = await analyzeProject(absPath, force);
    const response: AnalyzeResponse = {
      cacheKey: cacheKey(absPath),
      cached: cacheHit,
      snapshot,
    };
    res.json(response);
  } catch (err) {
    console.error('[/api/analyze]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET cache status
router.get('/status', (req: Request, res: Response) => {
  const { projectPath } = req.query as { projectPath?: string };
  if (!projectPath) {
    res.status(400).json({ error: 'projectPath query param required' });
    return;
  }
  const key = cacheKey(path.resolve(projectPath));
  res.json({ cacheKey: key });
});

export default router;
