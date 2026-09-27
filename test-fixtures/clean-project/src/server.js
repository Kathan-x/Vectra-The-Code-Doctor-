/**
 * server.js - Clean Express service entry point
 */
const express = require('express');
const { calculateAverage, clamp } = require('./mathUtils');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'clean-service' });
});

app.post('/api/stats', (req, res) => {
  const values = req.body && Array.isArray(req.body.values) ? req.body.values : [];
  const avg = calculateAverage(values);
  const bounded = clamp(avg, 0, 100);
  res.json({ average: avg, clamped: bounded });
});

module.exports = app;
