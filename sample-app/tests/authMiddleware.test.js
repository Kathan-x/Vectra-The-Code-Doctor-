/**
 * Tests for authMiddleware.js
 *
 * Expected results (before repair):
 *   PASS: generateToken produces a string
 *   PASS: requireAuth passes with a valid token
 *   PASS: requireAuth rejects missing Authorization header
 *   FAIL: requireAuth rejects an invalid token           → BUG-003: next() called instead of 401
 *   FAIL: requireAuth rejects a tampered token           → BUG-003: next() called instead of 401
 */

const { requireAuth, generateToken } = require('../src/authMiddleware');

// ── Helper: wrap requireAuth in a Promise ────────────────────────────

function runMiddleware(headers) {
  return new Promise((resolve) => {
    const req = { headers };
    const res = {
      _status: null,
      _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; resolve({ called: 'res', status: this._status, body }); return this; },
    };
    const next = () => resolve({ called: 'next' });
    requireAuth(req, res, next);
  });
}

// ── generateToken ────────────────────────────────────────────────────

describe('generateToken', () => {
  test('returns a JWT string', () => {
    const token = generateToken({ id: 1, email: 'alice@example.com', role: 'admin' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

// ── requireAuth ──────────────────────────────────────────────────────

describe('requireAuth', () => {
  test('passes through with a valid token', async () => {
    const token = generateToken({ id: 2, email: 'bob@example.com', role: 'user' });
    const result = await runMiddleware({ authorization: `Bearer ${token}` });
    expect(result.called).toBe('next');
  });

  test('rejects request with no Authorization header', async () => {
    const result = await runMiddleware({});
    expect(result.called).toBe('res');
    expect(result.status).toBe(401);
  });

  // ── EXPECTED FAILURE ────────────────────────────────────────────────
  // BUG-003: `if (err = null)` — assignment instead of comparison.
  // Invalid token should respond 401, but next() is called instead.
  // Fix: change `if (err = null)` → `if (err !== null)`
  test('rejects request with an invalid token', async () => {
    const result = await runMiddleware({ authorization: 'Bearer this.is.not.valid' });
    // ❌ WILL FAIL: result.called === 'next', not 'res'
    expect(result.called).toBe('res');
    expect(result.status).toBe(401);
  });

  // ── EXPECTED FAILURE ────────────────────────────────────────────────
  // BUG-003: tampered token should also be rejected
  test('rejects a tampered token', async () => {
    const token = generateToken({ id: 2, email: 'bob@example.com', role: 'user' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const result = await runMiddleware({ authorization: `Bearer ${tampered}` });
    // ❌ WILL FAIL: result.called === 'next', not 'res'
    expect(result.called).toBe('res');
    expect(result.status).toBe(401);
  });
});
