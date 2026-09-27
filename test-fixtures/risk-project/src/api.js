/**
 * api.js - Express API router coordinating auth and database queries
 */

const express = require('express');
const { authenticate } = require('./auth');
const { findUserByQuery } = require('./db');

const app = express();
app.use(express.json());

app.post('/api/login', (req, res) => {
  const token = req.headers.authorization;
  const result = authenticate(token);
  if (!result.authenticated) {
    return res.status(401).json({ error: result.error });
  }
  return res.json({ status: 'ok', user: result.user });
});

app.get('/api/users/search', (req, res) => {
  const name = req.query.name || '';
  const users = findUserByQuery(name);
  res.json({ users });
});

module.exports = app;
