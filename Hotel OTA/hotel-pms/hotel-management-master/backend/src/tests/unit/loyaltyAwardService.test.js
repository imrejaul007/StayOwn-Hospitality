import { calculateStayPoints } from '../../services/loyaltyAwardService.js';

describe('loyaltyAwardService.calculateStayPoints', () => {
  const cfg = {
    enabled: true,
    pointsPerCurrencyUnit: 0.1,
    pointsPerNight: 5,
    maxPointsPerStay: 50000
  };

  it('combines spend-based and per-night points', () => {
    const points = calculateStayPoints(
      { totalAmount: 1000, nights: 2 },
      cfg
    );
    expect(points).toBe(Math.floor(1000 * 0.1) + Math.floor(2 * 5));
  });

  it('respects max cap', () => {
    const capped = calculateStayPoints(
      { totalAmount: 999999, nights: 1 },
      { ...cfg, maxPointsPerStay: 500 }
    );
    expect(capped).toBe(500);
  });

  it('uses at least one night when nights missing', () => {
    const points = calculateStayPoints({ totalAmount: 100, nights: undefined }, cfg);
    expect(points).toBe(Math.floor(100 * 0.1) + Math.floor(1 * 5));
  });
});
