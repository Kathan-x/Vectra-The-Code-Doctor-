/**
 * Date formatting utilities.
 *
 * VECTRA_ISSUE[BUG-007]: formatDate uses `new Date(dateString)` directly.
 *   The Date constructor parses ISO date strings (YYYY-MM-DD) as UTC midnight,
 *   but then toLocaleDateString() converts to local time — in timezones behind
 *   UTC (e.g. UTC-5) this shifts the date back by one day.
 *   Fix: parse the date parts explicitly: new Date(year, month-1, day)
 *   Severity: medium | Category: bug (timezone off-by-one)
 */

/**
 * Format an ISO date string (YYYY-MM-DD) to a human-readable locale string.
 * VECTRA_ISSUE[BUG-007] — UTC-to-local shift causes wrong date in some timezones
 * @param {string} dateString  e.g. '2024-03-15'
 * @param {string} [locale]    e.g. 'en-US'
 * @returns {string}
 */
function formatDate(dateString, locale = 'en-US') {
  // ❌ BUG-007: Date constructor treats YYYY-MM-DD as UTC midnight,
  // toLocaleDateString converts to local time → wrong day in UTC- timezones
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Return the number of days between two ISO date strings.
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(to) - new Date(from)) / msPerDay);
}

/**
 * Check whether an ISO date string represents a past date.
 * @param {string} dateString
 * @returns {boolean}
 */
function isPastDate(dateString) {
  return new Date(dateString) < new Date();
}

module.exports = { formatDate, daysBetween, isPastDate };
