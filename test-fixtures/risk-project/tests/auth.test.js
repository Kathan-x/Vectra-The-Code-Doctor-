const { authenticate } = require('../src/auth');

describe('authenticate', () => {
  test('accepts valid session token', () => {
    const result = authenticate('valid-session-token');
    expect(result.authenticated).toBe(true);
    expect(result.user).toBeDefined();
  });

  test('rejects missing or invalid token', () => {
    const result = authenticate('tampered-or-bad-token');
    // Fails because if (authError = null) sets authError to null
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});
