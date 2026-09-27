/**
 * Data processing utilities.
 *
 * VECTRA_ISSUE[BUG-004]: paginateResults uses `<= totalPages` (off-by-one).
 *   When page === totalPages the slice range is valid, but the condition allows
 *   page = totalPages + 1 through, returning an empty array silently instead
 *   of a proper bounds error. The correct guard is `page > totalPages`.
 *   Severity: medium | Category: bug (off-by-one)
 *
 * VECTRA_ISSUE[BUG-005]: summariseScores does not handle null/undefined values
 *   in the scores array — calling .reduce on an array containing null throws
 *   "Cannot read properties of null".
 *   Severity: high | Category: bug (missing null guard)
 *
 * VECTRA_ISSUE[QUALITY-001]: calculateStats is an overly complex function that
 *   does three distinct things (stats, formatting, filtering) inline.
 *   Should be split into smaller, testable functions.
 *   Severity: low | Category: quality (maintainability)
 */

/**
 * Paginate an array of items.
 * VECTRA_ISSUE[BUG-004] — off-by-one: allows out-of-bounds page numbers
 * @param {unknown[]} items
 * @param {number} page  1-based
 * @param {number} pageSize
 */
function paginateResults(items, page, pageSize) {
  const totalPages = Math.ceil(items.length / pageSize);

  // ❌ BUG-004: should be `page > totalPages` — allows page === totalPages + 1
  if (page < 1 || page > totalPages + 1) {
    throw new RangeError(`Page ${page} out of range (1–${totalPages})`);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page,
    pageSize,
    totalPages,
    total: items.length,
  };
}

/**
 * Summarise an array of numeric scores.
 * VECTRA_ISSUE[BUG-005] — no null/undefined guard
 * @param {Array<number|null>} scores
 */
function summariseScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) {
    return { min: 0, max: 0, average: 0, count: 0 };
  }

  // ❌ BUG-005: null values in array cause TypeError in reduce
  const total = scores.reduce((acc, val) => acc + val, 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return {
    min,
    max,
    average: parseFloat((total / scores.length).toFixed(2)),
    count: scores.length,
  };
}

/**
 * VECTRA_ISSUE[QUALITY-001] — overly complex, mixed responsibilities.
 * Computes stats, formats output, AND filters — should be three functions.
 * @param {Array<{ id: number, name: string, score: number, active: boolean }>} records
 * @param {{ minScore?: number, activeOnly?: boolean, format?: 'json'|'csv' }} options
 */
function calculateStats(records, options = {}) {
  const { minScore = 0, activeOnly = false, format = 'json' } = options;

  // filter
  let filtered = records.filter(r => r.score >= minScore);
  if (activeOnly) filtered = filtered.filter(r => r.active);

  // stats
  const total = filtered.reduce((a, r) => a + r.score, 0);
  const avg = filtered.length ? total / filtered.length : 0;
  const max = filtered.reduce((a, r) => (r.score > a ? r.score : a), -Infinity);
  const min = filtered.reduce((a, r) => (r.score < a ? r.score : a), Infinity);

  const stats = { count: filtered.length, avg: parseFloat(avg.toFixed(2)), max, min };

  // format
  if (format === 'csv') {
    const header = 'id,name,score,active';
    const rows = filtered.map(r => `${r.id},${r.name},${r.score},${r.active}`);
    return [header, ...rows].join('\n');
  }

  return { stats, records: filtered };
}

module.exports = { paginateResults, summariseScores, calculateStats };
