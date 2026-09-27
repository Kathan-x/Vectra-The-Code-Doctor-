/**
 * VECTRA Bob Client — IBM Bob Shell Integration
 *
 * Interacts with IBM Bob CLI (`bob run`) in headless non-interactive mode.
 * - Authenticates using the configured Windows environment variable `BOB_API_KEY`.
 * - Never logs, prints, or exposes the API key to the frontend or consoles.
 * - Sets `--workspace` strictly to the target project directory.
 * - Streams assistant tokens via `--format stream-json`.
 * - Bounded by `--max-turns` and a process timeout to control usage.
 */

import { spawn } from 'child_process';
import readline from 'readline';

export class BobUnavailableError extends Error {
  constructor(reason: string) {
    super(`Bob unavailable: ${reason}`);
    this.name = 'BobUnavailableError';
  }
}

export interface BobRunOptions {
  /** Absolute path to the project Bob should operate on */
  cwd: string;
  /** Maximum agent turns */
  maxTurns?: number;
  /** Callback for each streamed text chunk */
  onChunk?: (text: string) => void;
  /** Maximum timeout in ms (default: 60000) */
  timeoutMs?: number;
}

export interface BobResult {
  /** Final assistant text output */
  text: string;
  /** True if the run completed successfully */
  success: boolean;
  /** Error message if the run did not succeed */
  error?: string;
}

let cachedAvailability: { available: boolean; reason?: string; timestamp: number } | null = null;

/**
 * Checks whether IBM Bob is available on the host machine.
 * Validates BOB_API_KEY presence and CLI responsiveness. Caches for 60s.
 */
export async function isBobAvailable(): Promise<{ available: boolean; reason?: string }> {
  const now = Date.now();
  if (cachedAvailability && now - cachedAvailability.timestamp < 60_000) {
    return { available: cachedAvailability.available, reason: cachedAvailability.reason };
  }

  const apiKey = process.env.BOB_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    cachedAvailability = {
      available: false,
      reason: 'BOB_API_KEY environment variable not set',
      timestamp: now,
    };
    return { available: false, reason: cachedAvailability.reason };
  }

  // Quick verification: test if `bob` command can run
  return new Promise((resolve) => {
    try {
      const isWin = process.platform === 'win32';
      const proc = isWin
        ? spawn('cmd.exe', ['/c', 'bob', '--version'], {
            windowsHide: true,
            env: { ...process.env },
          })
        : spawn('bob', ['--version'], {
            env: { ...process.env },
          });

      let stdout = '';
      proc.stdout?.on('data', (d) => { stdout += d.toString(); });
      
      const timeout = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch {}
        cachedAvailability = { available: false, reason: 'Bob CLI response timed out', timestamp: now };
        resolve({ available: false, reason: cachedAvailability.reason });
      }, 5000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && stdout.trim().length > 0) {
          cachedAvailability = { available: true, timestamp: now };
          resolve({ available: true });
        } else {
          cachedAvailability = { available: false, reason: `Bob CLI exited with code ${code}`, timestamp: now };
          resolve({ available: false, reason: cachedAvailability.reason });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        cachedAvailability = { available: false, reason: err.message, timestamp: now };
        resolve({ available: false, reason: cachedAvailability.reason });
      });
    } catch (err: any) {
      cachedAvailability = { available: false, reason: err.message, timestamp: now };
      resolve({ available: false, reason: cachedAvailability.reason });
    }
  });
}

/**
 * Runs an IBM Bob agent task against a project directory using `bob run`.
 * Streams assistant output via `options.onChunk`.
 */
export async function runBob(prompt: string, options: BobRunOptions): Promise<BobResult> {
  const { cwd, maxTurns = 15, onChunk, timeoutMs = 60_000 } = options;

  const apiKey = process.env.BOB_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new BobUnavailableError('BOB_API_KEY environment variable not set');
  }

  const isWin = process.platform === 'win32';

  // Build CLI arguments — prompt is sent over stdin to eliminate OS command-line limits
  const bobArgs = [
    'run',
    '--accept-license',
    '--trust',
    '-w', cwd,
    '--format', 'stream-json',
    '--max-turns', String(maxTurns),
  ];

  return new Promise((resolve) => {
    let fullAssistantText = '';
    let completed = false;
    let errorOutput = '';

    const proc = isWin
      ? spawn('cmd.exe', ['/c', 'bob', ...bobArgs], {
          env: { ...process.env },
          windowsHide: true,
        })
      : spawn('bob', bobArgs, {
          env: { ...process.env },
        });

    // Write prompt into stdin stream and close it
    if (proc.stdin) {
      proc.stdin.write(prompt + '\n');
      proc.stdin.end();
    }

    const rl = readline.createInterface({ input: proc.stdout });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const ev = JSON.parse(trimmed);
        if (ev.type === 'message' && ev.role === 'assistant') {
          const chunk = ev.content || '';
          fullAssistantText += chunk;
          onChunk?.(chunk);
        } else if (ev.type === 'result') {
          completed = true;
          const resultText = fullAssistantText || ev.last_message || '';
          const success = ev.status === 'success';
          try { proc.kill('SIGTERM'); } catch {}
          resolve({
            text: resultText,
            success,
            error: success ? undefined : (ev.error || 'Bob run returned unsuccessful status'),
          });
        }
      } catch {
        // Plain text fallback from CLI
        if (!trimmed.startsWith('{')) {
          fullAssistantText += trimmed + '\n';
        }
      }
    });

    proc.stderr?.on('data', (d) => {
      errorOutput += d.toString();
    });

    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        try { proc.kill('SIGKILL'); } catch {}
        resolve({
          text: fullAssistantText,
          success: false,
          error: `Bob execution timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
      }
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (!completed) {
        completed = true;
        const success = code === 0 || fullAssistantText.length > 0;
        resolve({
          text: fullAssistantText,
          success,
          error: success ? undefined : (errorOutput || `Bob process exited with code ${code}`),
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (!completed) {
        completed = true;
        resolve({
          text: fullAssistantText,
          success: false,
          error: err.message,
        });
      }
    });
  });
}
