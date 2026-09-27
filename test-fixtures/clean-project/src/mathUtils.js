/**
 * mathUtils.js - Clean mathematical helper functions
 */

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function calculateAverage(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
  return sum / numbers.length;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

module.exports = {
  add,
  multiply,
  calculateAverage,
  clamp,
};
