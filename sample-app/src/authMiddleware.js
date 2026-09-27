/**
 * Authentication middleware.
 *
 * VECTRA_ISSUE[BUG-003]: verifyToken uses the wrong comparison operator.
 *   Line 34: `if (err = null)` assigns null to err instead of checking it.
 *   This means authentication ALWAYS succeeds regardless of token validity —
 *   any token (or no token) passes the auth check.
 *   Should be: `if (err !== null)`
 *   Severity: critical | Category: bug (logic error)
 */

const jwt = require('jsonwebtoken');
const config = require('./config');

/**
 * Express middleware: verify Bearer JWT token.
 * Attaches decoded payload to req.user on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    // ❌ BUG-003: assignment (=) instead of strict inequality (!==)
    // This condition is always falsy — err is overwritten with null,
    // so authentication never fails, even for invalid/expired tokens.
    if (err !== null) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Generate a signed JWT for a user object.
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string}
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.tokenExpiry }
  );
}

module.exports = { requireAuth, generateToken };
