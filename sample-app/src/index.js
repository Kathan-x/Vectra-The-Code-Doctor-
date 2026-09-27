/**
 * VECTRA Sample Application — Express entry point.
 * A small, realistic multi-module API with intentional issues for VECTRA to detect.
 *
 * Intentional issues catalogue (see VECTRA_ISSUES.md for full details):
 *   SEC-001  Hardcoded JWT secret              config.js:12
 *   SEC-002  Hardcoded DB password             config.js:18
 *   BUG-001  SQL injection (string concat)     userService.js:25
 *   BUG-002  Null deref before check           userService.js:62
 *   BUG-003  Auth always passes (= vs !==)     authMiddleware.js:31
 *   BUG-004  Pagination off-by-one             dataProcessor.js:32
 *   BUG-005  Null values crash summarise       dataProcessor.js:56
 *   BUG-006  Unhandled async rejection         emailService.js:42
 *   BUG-007  Timezone shift in date format     utils/formatDate.js:22
 *   QUALITY-001  Overly complex calculateStats dataProcessor.js:74
 *   QUALITY-002  Dead code legacySendEmail     emailService.js:62
 */

const express = require('express');
const { requireAuth, generateToken } = require('./authMiddleware');
const { getUserByEmail, getUserById, createUser, updateUser } = require('./userService');
const { paginateResults, summariseScores, calculateStats } = require('./dataProcessor');
const { sendWelcomeEmail } = require('./emailService');
const { formatDate, daysBetween } = require('./utils/formatDate');
const config = require('./config');

const app = express();
app.use(express.json());

// ── Auth routes ─────────────────────────────────────────────────────

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User routes ─────────────────────────────────────────────────────

app.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    await sendWelcomeEmail(user);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/users/:id', requireAuth, async (req, res) => {
  try {
    const updated = await updateUser(Number(req.params.id), req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Data routes ──────────────────────────────────────────────────────

app.get('/data/paginate', requireAuth, (req, res) => {
  try {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, value: `item-${i + 1}` }));
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    res.json(paginateResults(items, page, pageSize));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/data/scores', requireAuth, (req, res) => {
  try {
    const { scores } = req.body;
    res.json(summariseScores(scores));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Utility routes ───────────────────────────────────────────────────

app.get('/util/format-date', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required' });
  res.json({ formatted: formatDate(date), daysSince: daysBetween(date, new Date().toISOString().slice(0, 10)) });
});

// ── Start ────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Sample app listening on http://localhost:${config.port}`);
  });
}

module.exports = app;
