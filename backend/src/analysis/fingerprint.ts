/**
 * fingerprint.ts — Stable finding identity and correlation for VECTRA.
 *
 * Normalizes rule IDs, file paths, titles, and evidence so that issues can
 * be tracked deterministically across file edits, line shifts, and re-analysis.
 */

import path from 'path';
import type { Finding } from '../types';

export function normalizeFilePath(file: string): string {
  if (!file) return '';
  return file.replace(/\\/g, '/').toLowerCase().trim();
}

export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a stable, deterministic fingerprint string for a finding.
 * Format: `<normalizedRuleId>::<normalizedRelativePath>::<normalizedTitle>`
 */
export function getFindingFingerprint(finding: {
  ruleId?: string;
  file: string;
  title: string;
}): string {
  const normRule = normalizeText(finding.ruleId || 'generic-rule');
  const normFile = normalizeFilePath(finding.file);
  const normTitle = normalizeText(finding.title);
  return `${normRule}::${normFile}::${normTitle}`;
}

/**
 * Robust bipartite comparison to test whether two findings represent the identical defect.
 */
export function areFindingsEqual(a: Finding, b: Finding): boolean {
  // Must match file
  if (normalizeFilePath(a.file) !== normalizeFilePath(b.file)) return false;

  // If both have rules, they must match
  if (a.ruleId && b.ruleId) {
    if (normalizeText(a.ruleId) !== normalizeText(b.ruleId)) return false;
  }

  // 1. Direct fingerprint match
  if (getFindingFingerprint(a) === getFindingFingerprint(b)) return true;

  // 2. Direct ID match
  if (a.id && b.id && a.id === b.id) return true;

  // 3. Evidence exact match
  if (a.evidence && b.evidence && normalizeText(a.evidence) === normalizeText(b.evidence)) {
    return true;
  }

  // 4. Line proximity + title match
  if (Math.abs((a.line || 0) - (b.line || 0)) <= 3) {
    if (normalizeText(a.title) === normalizeText(b.title)) return true;
  }

  return false;
}
