import fs from 'fs';
import path from 'path';
import type { ProjectInfo, LanguageCompositionItem, SubprojectInfo } from '../types';

export const SOURCE_EXTS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']);
export const TEST_PATTERNS = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /[\\/]tests?[\\/]/i, /__tests__/i];

/** Centralized list of generated / runtime / cache directories to skip everywhere */
export const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.dart_tool',
  'build',
  'dist',
  'coverage',
  '.nyc_output',
  '.gradle',
  '.mongo-data',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.claude',
]);

export const CODE_EXT_MAP: Record<string, { language: string; analyzed: boolean }> = {
  '.js':   { language: 'JavaScript', analyzed: true },
  '.jsx':  { language: 'JavaScript', analyzed: true },
  '.mjs':  { language: 'JavaScript', analyzed: true },
  '.cjs':  { language: 'JavaScript', analyzed: true },
  '.ts':   { language: 'TypeScript', analyzed: true },
  '.tsx':  { language: 'TypeScript', analyzed: true },
  '.dart': { language: 'Dart', analyzed: false },
  '.py':   { language: 'Python', analyzed: false },
  '.java': { language: 'Java', analyzed: false },
  '.go':   { language: 'Go', analyzed: false },
  '.rb':   { language: 'Ruby', analyzed: false },
  '.rs':   { language: 'Rust', analyzed: false },
  '.php':  { language: 'PHP', analyzed: false },
  '.cs':   { language: 'C#', analyzed: false },
  '.cpp':  { language: 'C++', analyzed: false },
  '.c':    { language: 'C', analyzed: false },
  '.html': { language: 'HTML', analyzed: false },
  '.css':  { language: 'CSS', analyzed: false },
  '.scss': { language: 'SCSS', analyzed: false },
};

const MAX_SOURCE_FILE_SIZE = 500 * 1024; // 500 KB limit to avoid minified bundles

interface WalkResult {
  allFiles: string[];
  analyzedSourceFiles: string[];
  languageCounts: Record<string, { count: number; analyzed: boolean }>;
  subprojects: SubprojectInfo[];
  excludedCount: number;
}

function walkProjectTree(projectRoot: string): WalkResult {
  const result: WalkResult = {
    allFiles: [],
    analyzedSourceFiles: [],
    languageCounts: {},
    subprojects: [],
    excludedCount: 0,
  };

  const seenSubprojects = new Set<string>();

  function traverse(dir: string, depth: number) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Check for subproject manifests in this directory (if not root)
    if (dir !== projectRoot) {
      const relDir = path.relative(projectRoot, dir).replace(/\\/g, '/');
      const hasPkgJson = entries.some(e => e.isFile() && e.name === 'package.json');
      const hasPubspec = entries.some(e => e.isFile() && e.name === 'pubspec.yaml');
      const hasPyProject = entries.some(e => e.isFile() && (e.name === 'pyproject.toml' || e.name === 'requirements.txt'));

      if (hasPkgJson && !seenSubprojects.has(relDir)) {
        seenSubprojects.add(relDir);
        let name = path.basename(dir);
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
          if (pkg.name) name = pkg.name;
        } catch {}
        result.subprojects.push({ name: formatFriendlyProjectName(name), path: relDir, type: 'Node.js / Express' });
      } else if (hasPubspec && !seenSubprojects.has(relDir)) {
        seenSubprojects.add(relDir);
        result.subprojects.push({ name: formatFriendlyProjectName(path.basename(dir)), path: relDir, type: 'Flutter / Dart' });
      } else if (hasPyProject && !seenSubprojects.has(relDir)) {
        seenSubprojects.add(relDir);
        result.subprojects.push({ name: formatFriendlyProjectName(path.basename(dir)), path: relDir, type: 'Python' });
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        if (EXCLUDED_DIRS.has(lowerName)) {
          // Count files in skipped directory if feasible
          try {
            const countFilesIn = (p: string): number => {
              let cnt = 0;
              try {
                const sub = fs.readdirSync(p, { withFileTypes: true });
                for (const s of sub) {
                  if (s.isDirectory()) cnt += countFilesIn(path.join(p, s.name));
                  else cnt++;
                }
              } catch {}
              return cnt;
            };
            result.excludedCount += countFilesIn(path.join(dir, entry.name));
          } catch {
            result.excludedCount += 50; // fallback estimate
          }
          continue;
        }
        traverse(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        result.allFiles.push(fullPath);

        const ext = path.extname(entry.name).toLowerCase();
        const codeInfo = CODE_EXT_MAP[ext];
        if (codeInfo) {
          if (!result.languageCounts[codeInfo.language]) {
            result.languageCounts[codeInfo.language] = { count: 0, analyzed: codeInfo.analyzed };
          }
          result.languageCounts[codeInfo.language].count++;
        }

        if (SOURCE_EXTS.has(ext)) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size <= MAX_SOURCE_FILE_SIZE) {
              result.analyzedSourceFiles.push(fullPath);
            }
          } catch {}
        }
      }
    }
  }

  traverse(projectRoot, 0);

  // Read .vectra-metadata.json if present for exact zip extraction counts
  const metaPath = path.join(projectRoot, '.vectra-metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (typeof meta.skippedCount === 'number') {
        result.excludedCount = meta.skippedCount;
      }
    } catch {}
  }

  return result;
}

function detectLanguage(sourceFiles: string[]): ProjectInfo['language'] {
  const hasTs = sourceFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const hasJs = sourceFiles.some(f => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.mjs'));
  if (hasTs && hasJs) return 'mixed';
  if (hasTs) return 'typescript';
  if (hasJs) return 'javascript';
  return 'unknown';
}

function detectFramework(pkgJson: Record<string, unknown> | undefined): string | undefined {
  if (!pkgJson) return undefined;
  const deps = {
    ...((pkgJson.dependencies as Record<string, string>) ?? {}),
    ...((pkgJson.devDependencies as Record<string, string>) ?? {}),
  };
  if (deps['next']) return 'Next.js';
  if (deps['react']) return 'React';
  if (deps['vue']) return 'Vue';
  if (deps['@angular/core']) return 'Angular';
  if (deps['@nestjs/core']) return 'NestJS';
  if (deps['express']) return 'Express';
  if (deps['fastify']) return 'Fastify';
  if (deps['koa']) return 'Koa';
  return undefined;
}

function detectPackageManager(projectPath: string, subDir?: string): 'npm' | 'yarn' | 'pnpm' | 'unknown' {
  const checkDirs = [projectPath];
  if (subDir && subDir !== projectPath) checkDirs.push(subDir);
  for (const d of checkDirs) {
    if (fs.existsSync(path.join(d, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(d, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(d, 'package-lock.json'))) return 'npm';
  }
  return 'npm';
}

/**
 * Searches for package.json at root, or in immediate subdirectories
 */
export function findPackageJson(projectPath: string): { pkgPath: string; pkgJson: Record<string, unknown>; dir: string } | null {
  const rootPkg = path.join(projectPath, 'package.json');
  if (fs.existsSync(rootPkg)) {
    try {
      const data = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
      return { pkgPath: rootPkg, pkgJson: data, dir: projectPath };
    } catch { /* ignore */ }
  }

  // Look in subdirectories
  const candidateDirs = ['backend', 'server', 'api', 'app', 'src'];
  for (const sub of candidateDirs) {
    const candidate = path.join(projectPath, sub, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const data = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        return { pkgPath: candidate, pkgJson: data, dir: path.join(projectPath, sub) };
      } catch { /* ignore */ }
    }
  }

  // Recursively search child directories (up to depth 2)
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || EXCLUDED_DIRS.has(entry.name.toLowerCase())) continue;
      const sub = path.join(projectPath, entry.name);
      const subPkg = path.join(sub, 'package.json');
      if (fs.existsSync(subPkg)) {
        try {
          const data = JSON.parse(fs.readFileSync(subPkg, 'utf-8'));
          return { pkgPath: subPkg, pkgJson: data, dir: sub };
        } catch {}
      }
      try {
        const subEntries = fs.readdirSync(sub, { withFileTypes: true });
        for (const sub2 of subEntries) {
          if (!sub2.isDirectory() || EXCLUDED_DIRS.has(sub2.name.toLowerCase())) continue;
          const sub2Path = path.join(sub, sub2.name);
          const sub2Pkg = path.join(sub2Path, 'package.json');
          if (fs.existsSync(sub2Pkg)) {
            try {
              const data = JSON.parse(fs.readFileSync(sub2Pkg, 'utf-8'));
              return { pkgPath: sub2Pkg, pkgJson: data, dir: sub2Path };
            } catch {}
          }
        }
      } catch {}
    }
  } catch {}

  return null;
}

/** Formats a clean, professional friendly display name */
export function formatFriendlyProjectName(rawName: string): string {
  if (rawName === 'vectra-sample-app' || rawName === 'sample-app') {
    return 'VECTRA Demo Service';
  }
  // Strip import prefix like 8a8717359af4-
  const cleaned = rawName.replace(/^[a-f0-9]{12}[-_]/, '');
  return cleaned
    .replace(/[_-]+/g, ' ')
    .replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bDb\b/g, 'DB')
    .replace(/\bCp\b/g, 'CP')
    .trim();
}

/**
 * Discovers full repository architecture:
 * Archive Root = Project Root.
 * Discovers all source files recursively throughout the entire project.
 */
export function discoverProject(projectPath: string): ProjectInfo {
  const absPath = path.resolve(projectPath);

  // Check root package.json first
  const rootPkgPath = path.join(absPath, 'package.json');
  let pkgJson: Record<string, unknown> | undefined;
  if (fs.existsSync(rootPkgPath)) {
    try {
      pkgJson = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    } catch {}
  }

  // Walk all files in the project tree
  const walk = walkProjectTree(absPath);

  // If no root package.json, check if subproject package.json exists to help detect framework
  let detectedSubPkg = pkgJson;
  let subDir: string | undefined;
  if (!detectedSubPkg && walk.subprojects.length > 0) {
    for (const sub of walk.subprojects) {
      const p = path.join(absPath, sub.path, 'package.json');
      if (fs.existsSync(p)) {
        try {
          detectedSubPkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          subDir = path.join(absPath, sub.path);
          break;
        } catch {}
      }
    }
  }

  // Name: root package name, or folder name
  let name = (pkgJson?.name as string | undefined) ?? path.basename(absPath);
  name = formatFriendlyProjectName(name);

  const testFiles = walk.analyzedSourceFiles.filter(f => TEST_PATTERNS.some(p => p.test(f)));
  const nonTestSourceFiles = walk.analyzedSourceFiles.filter(f => !TEST_PATTERNS.some(p => p.test(f)));

  // Identify top-level source directories
  const sourceDirSet = new Set<string>();
  for (const sf of nonTestSourceFiles) {
    const rel = path.relative(absPath, sf).replace(/\\/g, '/');
    const parts = rel.split('/');
    if (parts.length > 1) {
      sourceDirSet.add(parts.slice(0, Math.min(2, parts.length - 1)).join('/'));
    }
  }

  // Identify top-level test directories
  const testDirSet = new Set<string>();
  for (const tf of testFiles) {
    const rel = path.relative(absPath, tf).replace(/\\/g, '/');
    const parts = rel.split('/');
    if (parts.length > 1) {
      testDirSet.add(parts.slice(0, Math.min(2, parts.length - 1)).join('/'));
    }
  }

  // Compute language composition
  const totalCodeFiles = Object.values(walk.languageCounts).reduce((acc, cur) => acc + cur.count, 0);
  const composition: LanguageCompositionItem[] = Object.entries(walk.languageCounts)
    .map(([language, data]) => ({
      language,
      fileCount: data.count,
      percentage: totalCodeFiles > 0 ? Math.round((data.count / totalCodeFiles) * 100) : 0,
      analyzed: data.analyzed,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Fix percentage rounding drift so dominant language absorbs rounding if needed
  const totalPct = composition.reduce((sum, item) => sum + item.percentage, 0);
  if (composition.length > 0 && totalPct !== 100 && totalPct > 0) {
    composition[0].percentage += (100 - totalPct);
  }

  return {
    path: absPath,
    name,
    language: detectLanguage(walk.analyzedSourceFiles),
    framework: detectFramework(pkgJson ?? detectedSubPkg),
    fileCount: nonTestSourceFiles.length,
    sourceFiles: nonTestSourceFiles.map(f => path.relative(absPath, f)),
    testFiles: testFiles.map(f => path.relative(absPath, f)),
    packageJson: pkgJson ?? detectedSubPkg,
    packageManager: detectPackageManager(absPath, subDir),
    sourceDirs: Array.from(sourceDirSet).slice(0, 6),
    testDirs: Array.from(testDirSet).slice(0, 4),
    scope: {
      totalFiles: walk.allFiles.length,
      analyzedFiles: nonTestSourceFiles.length,
      testFiles: testFiles.length,
      excludedFiles: walk.excludedCount,
    },
    composition,
    subprojects: walk.subprojects.length > 0 ? walk.subprojects : undefined,
  };
}
