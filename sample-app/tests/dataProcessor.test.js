/**
 * Tests for dataProcessor.js
 *
 * Expected results (before repair):
 *   PASS: paginateResults — valid first page
 *   PASS: paginateResults — valid last page
 *   PASS: summariseScores — normal numbers
 *   PASS: calculateStats  — filter + json output
 *   FAIL: paginateResults — out-of-bounds page  → BUG-004: no error thrown
 *   FAIL: summariseScores — array with null     → BUG-005: TypeError crash
 */

const { paginateResults, summariseScores, calculateStats } = require('../src/dataProcessor');

const ITEMS = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, value: `item-${i + 1}` }));

describe('paginateResults', () => {
  test('returns correct slice for page 1', () => {
    const result = paginateResults(ITEMS, 1, 10);
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe(1);
    expect(result.totalPages).toBe(3);
  });

  test('returns correct slice for last valid page', () => {
    const result = paginateResults(ITEMS, 3, 10);
    expect(result.items).toHaveLength(5);
    expect(result.page).toBe(3);
  });

  // ── EXPECTED FAILURE ─────────────────────────────────────────────────
  // BUG-004: page 4 is out of range (totalPages = 3) but the guard
  // only throws when page > totalPages + 1 (i.e. page > 4).
  // Requesting page 4 returns empty items silently instead of a RangeError.
  test('throws RangeError for out-of-bounds page', () => {
    expect(() => paginateResults(ITEMS, 4, 10)).toThrow(RangeError); // ❌ WILL FAIL
  });
});

describe('summariseScores', () => {
  test('returns correct stats for valid number array', () => {
    const result = summariseScores([10, 20, 30, 40]);
    expect(result.average).toBe(25);
    expect(result.min).toBe(10);
    expect(result.max).toBe(40);
    expect(result.count).toBe(4);
  });

  test('returns zeros for empty array', () => {
    const result = summariseScores([]);
    expect(result.count).toBe(0);
    expect(result.average).toBe(0);
  });

  // ── EXPECTED FAILURE ─────────────────────────────────────────────────
  // BUG-005: null in the array causes `acc + null` → NaN propagation,
  // and Math.min(...[10, null, 5]) returns 0 (wrong), not 5.
  // Real fix: filter out non-numbers before reduce/min/max.
  test('handles array containing null values gracefully', () => {
    const result = summariseScores([10, null, 5]);
    expect(result.count).toBe(2);   // only count non-null values
    expect(result.average).toBe(7.5); // ❌ WILL FAIL: actual is NaN
    expect(result.min).toBe(5);       // ❌ actual is 0 (Math.min coerces null)
  });
});

describe('calculateStats', () => {
  const RECORDS = [
    { id: 1, name: 'Alpha',   score: 80, active: true },
    { id: 2, name: 'Beta',    score: 40, active: false },
    { id: 3, name: 'Gamma',   score: 90, active: true },
    { id: 4, name: 'Delta',   score: 20, active: true },
  ];

  test('returns json output with stats and filtered records', () => {
    const { stats, records } = calculateStats(RECORDS, { minScore: 50 });
    expect(stats.count).toBe(2);
    expect(stats.avg).toBe(85);
    expect(records).toHaveLength(2);
  });
});
