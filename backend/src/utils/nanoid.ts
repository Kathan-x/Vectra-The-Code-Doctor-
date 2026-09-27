import { randomBytes, createHash } from 'crypto';

/** Generate a short random ID (URL-safe base64, 12 chars) */
export function nanoid(): string {
  return randomBytes(9).toString('base64url');
}

/** Generate a stable, deterministic finding ID based on rule, file, line, and title */
export function deterministicFindingId(ruleId: string, file: string, line?: number, title?: string): string {
  const normFile = file.replace(/\\/g, '/').toLowerCase();
  const raw = `${ruleId}::${normFile}::${line ?? 1}::${title ?? ''}`;
  return 'f_' + createHash('sha256').update(raw).digest('hex').slice(0, 10);
}
