/**
 * User service — CRUD operations over a simulated DB layer.
 *
 * VECTRA_ISSUE[BUG-001]: getUserByEmail builds query via string concatenation.
 *   Vulnerable to SQL injection. Should use parameterised query: db.query('...WHERE email = $1', [email])
 *   Severity: critical | Category: security/bug
 *
 * VECTRA_ISSUE[BUG-002]: updateUser does not check whether `user` exists before
 *   accessing user.role, causing a TypeError when the user is not found.
 *   Severity: high | Category: bug
 */

const db = require('./db');
const bcrypt = require('bcryptjs');
const config = require('./config');

/**
 * Find a user by email address.
 * VECTRA_ISSUE[BUG-001] — SQL injection via string concatenation
 * @param {string} email
 */
async function getUserByEmail(email) {
  // ❌ BUG-001: raw string interpolation — SQL injection vulnerability
  const query = "SELECT * FROM users WHERE email = '" + email + "'";
  const result = await db.query(query);
  return result.rows[0] || null;
}

/**
 * Get a user by ID.
 * @param {number} id
 */
async function getUserById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Create a new user.
 * @param {{ name: string, email: string, password: string }} data
 */
async function createUser(data) {
  const { name, email, password } = data;
  const hash = await bcrypt.hash(password, config.saltRounds);
  const result = await db.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [name, email, hash]
  );
  return result.rows[0];
}

/**
 * Update a user's profile.
 * VECTRA_ISSUE[BUG-002] — missing null check before accessing user.role
 * @param {number} id
 * @param {{ name?: string, email?: string }} updates
 */
async function updateUser(id, updates) {
  const user = await getUserById(id);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin') {
    throw new Error('Cannot modify admin accounts via this endpoint');
  }
  const { name, email } = updates;
  const result = await db.query(
    'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING *',
    [name || null, email || null, id]
  );
  return result.rows[0];
}

/**
 * Delete a user by ID.
 * @param {number} id
 */
async function deleteUser(id) {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
  return { deleted: true };
}

module.exports = { getUserByEmail, getUserById, createUser, updateUser, deleteUser };
