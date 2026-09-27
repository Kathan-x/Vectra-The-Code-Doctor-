/**
 * Tests for userService.js
 *
 * Expected results (before repair):
 *   PASS: getUserByEmail — found     (normal path works)
 *   PASS: getUserByEmail — not found (returns null)
 *   PASS: getUserById — found
 *   PASS: createUser — happy path
 *   PASS: updateUser — happy path (non-admin, existing user)
 *   FAIL: updateUser — missing user  → BUG-002 throws TypeError instead of useful error
 */

const { getUserByEmail, getUserById, createUser, updateUser } = require('../src/userService');
const db = require('../src/db');

beforeEach(() => db.reset());

describe('getUserByEmail', () => {
  test('returns user when email exists', async () => {
    const user = await getUserByEmail('bob@example.com');
    expect(user).not.toBeNull();
    expect(user.name).toBe('Bob Builder');
  });

  test('returns null when email not found', async () => {
    const user = await getUserByEmail('nobody@example.com');
    expect(user).toBeNull();
  });
});

describe('getUserById', () => {
  test('returns user when id exists', async () => {
    const user = await getUserById(2);
    expect(user).not.toBeNull();
    expect(user.email).toBe('bob@example.com');
  });
});

describe('createUser', () => {
  test('creates and returns new user', async () => {
    const user = await createUser({ name: 'Dave Dev', email: 'dave@example.com', password: 'pass123' });
    expect(user.id).toBe(4);
    expect(user.name).toBe('Dave Dev');
    expect(user.role).toBe('user');
  });
});

describe('updateUser', () => {
  test('updates name on existing non-admin user', async () => {
    const updated = await updateUser(2, { name: 'Bobby Builder' });
    expect(updated.name).toBe('Bobby Builder');
  });

  // ── EXPECTED FAILURE ────────────────────────────────────────────────
  // BUG-002: updateUser(999, ...) calls getUserById(999) → null,
  // then accesses null.role → TypeError: Cannot read properties of null
  // Fix: add `if (!user) throw new Error('User not found')` before role check
  test('throws descriptive error when user not found', async () => {
    await expect(updateUser(999, { name: 'Ghost' }))
      .rejects
      .toThrow('User not found');
    // ❌ WILL FAIL: actual error is "Cannot read properties of null (reading 'role')"
  });
});
