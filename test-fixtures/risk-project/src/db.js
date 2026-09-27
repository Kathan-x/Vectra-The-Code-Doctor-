/**
 * db.js - Database module with SQL query builder
 */

const db = {
  query(sql) {
    return [{ id: 1, name: 'Alice', role: 'user' }];
  },
};

function findUserByQuery(name) {
  // SQL Injection vulnerability via string concatenation (Critical)
  return db.query("SELECT * FROM users WHERE name = '" + name + "'");
}

module.exports = {
  db,
  findUserByQuery,
};
