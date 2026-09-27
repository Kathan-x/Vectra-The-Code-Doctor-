/**
 * Project Import Route
 *
 * POST /api/project/import  — Upload a ZIP file, extract it to a managed workspace,
 *                             return project metadata so the frontend can switch to it.
 *
 * GET  /api/project/default — Return the default demo project info.
 *
 * Robust large-archive handling:
 *  - Uses disk-backed streaming storage for uploads (up to 600 MB) to prevent out-of-memory crashes.
 *  - Intelligent extraction: safely skips generated/cache/runtime folders (node_modules, .git, .dart_tool, build, dist, .mongo-data, .gradle, etc.).
 *  - Strict path-traversal prevention (Zip Slip attack mitigation).
 *  - Automatically strips nested single wrapper directories.
 *  - Discovers project framework, language, package manager, and metadata.
 *  - Cleans up temporary uploaded archives immediately after processing.
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { discoverProject, EXCLUDED_DIRS } from '../analysis/discover';

const router = Router();

// ── Workspace directories ─────────────────────────────────────────────
const PROJECTS_DIR = path.resolve(__dirname, '../../../data/projects');
const TEMP_DIR = path.resolve(__dirname, '../../../data/temp');

function ensureDirectories() {
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ── Default demo project info ──────────────────────────────────────────
const DEMO_PATH = path.resolve(__dirname, '../../../sample-app');
const DEMO_INFO = {
  path:        DEMO_PATH,
  displayName: 'VECTRA Demo Service',
  typeLabel:   'Node.js · Express · JavaScript',
  isImported:  false,
};

// ── GET /api/project/default ──────────────────────────────────────────
router.get('/default', (_req: Request, res: Response) => {
  res.json(DEMO_INFO);
});

// ── Multer disk storage — supports up to 600 MB archives safely ───────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirectories();
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.zip';
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 600 * 1024 * 1024 }, // 600 MB
  fileFilter(_req, file, cb) {
    const name = file.originalname.toLowerCase();
    const ok = name.endsWith('.zip') ||
               file.mimetype === 'application/zip' ||
               file.mimetype === 'application/x-zip-compressed' ||
               file.mimetype === 'application/octet-stream';
    if (!ok) return cb(new Error('Only .zip files are accepted.'));
    cb(null, true);
  },
});

/**
 * Computes the longest common single-wrapper directory prefix
 * among all non-excluded, non-directory entries.
 */
function findCommonPrefix(entries: AdmZip.IZipEntry[]): string {
  const fileEntryPaths: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const normalized = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalized.split('/');
    // Check if any parent folder is in EXCLUDED_DIRS
    if (segments.some(seg => EXCLUDED_DIRS.has(seg))) continue;
    fileEntryPaths.push(normalized);
  }

  if (fileEntryPaths.length === 0) return '';

  let prefixParts = fileEntryPaths[0].split('/');
  prefixParts.pop(); // remove file name

  for (let i = 1; i < fileEntryPaths.length; i++) {
    const currentParts = fileEntryPaths[i].split('/');
    let j = 0;
    while (j < prefixParts.length && j < currentParts.length - 1 && prefixParts[j] === currentParts[j]) {
      j++;
    }
    prefixParts = prefixParts.slice(0, j);
    if (prefixParts.length === 0) break;
  }

  // Only strip if the prefix contains directories that shouldn't be flattened away
  // If the common prefix ends up containing standard project root files (like package.json), don't strip too far
  return prefixParts.length > 0 ? prefixParts.join('/') + '/' : '';
}

// ── POST /api/project/import ──────────────────────────────────────────
router.post('/import', upload.single('project'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Send a .zip file in multipart field "project".' });
    return;
  }

  const tempFilePath = req.file.path;
  ensureDirectories();

  // Stable project ID and sanitized folder name
  const rawBaseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const sanitizedName = rawBaseName.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim().slice(0, 30) || 'imported_project';
  const projectId = crypto.randomBytes(6).toString('hex');
  const projectDir = path.join(PROJECTS_DIR, `${projectId}-${sanitizedName}`);

  try {
    fs.mkdirSync(projectDir, { recursive: true });

    // Open zip directly from disk
    const zip = new AdmZip(tempFilePath);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new Error('The uploaded zip archive is empty.');
    }

    // Determine common root wrapper prefix
    const stripPrefix = findCommonPrefix(entries);

    let extractedCount = 0;
    let skippedCount = 0;

    for (const entry of entries) {
      const entryName = entry.entryName.replace(/\\/g, '/');

      // Security check: Zip Slip path traversal protection
      if (entryName.includes('../') || entryName.startsWith('/') || /^[a-zA-Z]:/.test(entryName)) {
        continue; // reject dangerous paths
      }

      // Check for intelligent generated/cache directory exclusions
      const segments = entryName.split('/');
      if (segments.some(seg => EXCLUDED_DIRS.has(seg))) {
        skippedCount++;
        continue;
      }

      // Strip wrapper prefix if applicable
      const relative = stripPrefix && entryName.startsWith(stripPrefix)
        ? entryName.slice(stripPrefix.length)
        : entryName;

      if (!relative || relative === '/') continue;

      const resolved = path.resolve(projectDir, relative);

      // Security check: must reside inside projectDir
      if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
        continue;
      }

      if (entry.isDirectory) {
        fs.mkdirSync(resolved, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, entry.getData());
        extractedCount++;
      }
    }

    // Auto-discover the project structure and metadata
    const info = discoverProject(projectDir);

    const displayName = info.name && info.name !== 'Imported Project' && info.name !== 'unknown'
      ? info.name
      : (rawBaseName || 'Imported Project');

    const langLabel = info.language === 'mixed' ? 'JavaScript / TypeScript' :
                      info.language === 'typescript' ? 'TypeScript' :
                      info.language === 'javascript' ? 'JavaScript' : 'Source Project';

    const typeParts = [langLabel, info.framework ?? ''].filter(Boolean);
    const typeLabel = typeParts.length > 0 ? typeParts.join(' · ') : 'Imported Project';

    // Persist metadata locally in project folder
    try {
      const meta = {
        projectId,
        originalArchiveName: req.file.originalname,
        importedAt: new Date().toISOString(),
        displayName,
        typeLabel,
        isImported: true,
        projectInfo: info,
        extractedCount,
        skippedCount,
      };
      fs.writeFileSync(path.join(projectDir, '.vectra-metadata.json'), JSON.stringify(meta, null, 2), 'utf-8');
    } catch { /* ignore non-fatal file write error */ }

    res.json({
      path: projectDir,
      displayName,
      typeLabel,
      isImported: true,
      projectId,
      projectInfo: info,
      extractedCount,
      skippedCount,
    });
  } catch (err) {
    // Clean up failed extraction
    try {
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    } catch { /* ignore */ }
    console.error('[/api/project/import]', err);
    res.status(500).json({ error: `Failed to extract project: ${(err as Error).message}` });
  } finally {
    // Always clean up the temporary uploaded archive file on disk
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch { /* ignore */ }
  }
});

export default router;
