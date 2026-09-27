/**
 * Application configuration.
 *
 * VECTRA_ISSUE[SEC-001]: JWT_SECRET is hardcoded.
 * Should be loaded from process.env.JWT_SECRET.
 * Severity: critical | Category: security
 */

const config = {
  port: process.env.PORT || 3000,
  // VECTRA_ISSUE[SEC-001] — hardcoded secret
  jwtSecret: 'super-secret-key-do-not-share-12345',
  tokenExpiry: '1h',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    name: 'appdb',
    // VECTRA_ISSUE[SEC-002] — hardcoded DB password
    password: 'admin1234',
  },
  saltRounds: 10,
};

module.exports = config;
