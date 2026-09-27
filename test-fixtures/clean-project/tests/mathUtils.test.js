const { add, multiply, calculateAverage, clamp } = require('../src/mathUtils');

describe('mathUtils', () => {
  test('adds two positive numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('multiplies numbers correctly', () => {
    expect(multiply(4, 5)).toBe(20);
  });

  test('calculates array average correctly', () => {
    expect(calculateAverage([10, 20, 30])).toBe(20);
  });

  test('clamps values within bounds', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});
