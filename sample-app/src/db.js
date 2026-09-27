/**
 * In-memory database stub.
 * Simulates a PostgreSQL-style interface so services can be tested without a real DB.
 * In production this would be replaced with a real pg.Pool.
 */

const store = {
  users: [
    { id: 1, name: 'Alice Admin',  email: 'alice@example.com', password_hash: '$2a$10$placeholder', role: 'admin' },
    { id: 2, name: 'Bob Builder',  email: 'bob@example.com',   password_hash: '$2a$10$placeholder', role: 'user' },
    { id: 3, name: 'Carol Coder',  email: 'carol@example.com', password_hash: '$2a$10$placeholder', role: 'user' },
  ],
  _nextId: 4,
};

/**
 * Minimal query simulator.
 * Supports a small subset of SQL patterns used by the services — enough for tests.
 * @param {string} sql
 * @param {unknown[]} [params]
 */
async function query(sql, params = []) {
  const s = sql.trim().toUpperCase();

  // SELECT by email (raw string — used by BUG-001 path)
  if (s.startsWith("SELECT * FROM USERS WHERE EMAIL = '")) {
    // extract the injected value between the single quotes
    const match = sql.match(/WHERE email = '([^']*)'/i);
    const email = match ? match[1] : '';
    const rows = store.users.filter(u => u.email === email);
    return { rows };
  }

  // SELECT by id
  if (s.startsWith('SELECT * FROM USERS WHERE ID = $1')) {
    const rows = store.users.filter(u => u.id === params[0]);
    return { rows };
  }

  // INSERT user
  if (s.startsWith('INSERT INTO USERS')) {
    const [name, email, password_hash] = params;
    const newUser = { id: store._nextId++, name, email, password_hash, role: 'user' };
    store.users.push(newUser);
    return { rows: [newUser] };
  }

  // UPDATE user
  if (s.startsWith('UPDATE USERS SET')) {
    const [name, email, id] = params;
    const idx = store.users.findIndex(u => u.id === id);
    if (idx === -1) return { rows: [] };
    const updated = store.users[idx];
    if (name !== null) { Object.assign(updated, { name }); }
    if (email !== null) { Object.assign(updated, { email }); }
    return { rows: [store.users[idx]] };
  }

  // DELETE user
  if (s.startsWith('DELETE FROM USERS WHERE ID = $1')) {
    store.users = store.users.filter(u => u.id !== params[0]);
    return { rows: [] };
  }

  return { rows: [] };
}

/** Reset store to original state — used between tests */
function reset() {
  store.users = [
    { id: 1, name: 'Alice Admin',  email: 'alice@example.com', password_hash: '$2a$10$placeholder', role: 'admin' },
    { id: 2, name: 'Bob Builder',  email: 'bob@example.com',   password_hash: '$2a$10$placeholder', role: 'user' },
    { id: 3, name: 'Carol Coder',  email: 'carol@example.com', password_hash: '$2a$10$placeholder', role: 'user' },
  ];
  store._nextId = 4;
}

module.exports = { query, reset };
