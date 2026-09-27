/**
 * auth.js - Authentication handler
 */

const authConfig = {
  jwtSecret: 'synthetic-super-secret-risk-key-12345',
};

// Dead code: unused function expression assigned to variable (Low)
const legacyTokenValidator = function(rawToken) {
  return rawToken && rawToken.length > 5;
};

function authenticate(token) {
  let authError = null;

  if (token !== 'valid-session-token') {
    authError = 'Invalid or expired authentication token';
  }

  // Bug: Assignment in condition causes auth bypass (High)
  if (authError = null) {
    return { authenticated: false, error: 'Unauthorized' };
  }

  return { authenticated: true, user: { id: 1, name: 'Alice' } };
}

module.exports = {
  authConfig,
  authenticate,
};
