import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AnalysisSnapshot } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../../data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** MD5 of the absolute project path — used as cache file name */
export function cacheKey(projectPath: string): string {
  return crypto.createHash('md5').update(path.resolve(projectPath)).digest('hex');
}

/** Newest mtime across all source files in the project (skips node_modules) */
function projectMtime(projectPath: string): number {
  let newest = 0;
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > newest) newest = mtime;
        } catch { /* ignore */ }
      }
    }
  }
  walk(path.resolve(projectPath));
  return newest;
}

interface CacheEntry {
  mtime: number;
  snapshot: AnalysisSnapshot;
}

export function readCache(projectPath: string): AnalysisSnapshot | null {
  ensureDataDir();
  const key = cacheKey(projectPath);
  const cachePath = path.join(DATA_DIR, `${key}.json`);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const entry = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheEntry;
    const currentMtime = projectMtime(projectPath);
    // Cache is valid if no file is newer than when we last analyzed
    if (currentMtime <= entry.mtime) {
      return entry.snapshot;
    }
    return null; // stale
  } catch {
    return null;
  }
}

export function writeCache(projectPath: string, snapshot: AnalysisSnapshot): string {
  ensureDataDir();
  const key = cacheKey(projectPath);
  const cachePath = path.join(DATA_DIR, `${key}.json`);
  const entry: CacheEntry = {
    mtime: projectMtime(projectPath),
    snapshot,
  };
  fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
  return key;
}
