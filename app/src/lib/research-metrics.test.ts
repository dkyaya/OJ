import { describe, expect, it } from 'vitest';
import { impliedMovePercent, realizedCloseToCloseMove, realizedMoveStats } from './research-metrics';

describe('research metrics', () => {
  it('calculates a straddle-implied percentage without claiming its horizon', () => {
    expect(impliedMovePercent(3, 2, 100)).toBe(5);
    expect(impliedMovePercent(3, 2, 0)).toBeUndefined();
  });

  it('keeps signed and absolute close-to-close reactions distinct', () => {
    expect(realizedCloseToCloseMove(100, 97)).toEqual({ signedPercent: -3, absolutePercent: 3 });
  });

  it('summarizes only the requested recent window', () => {
    const observations = [1, -2, 3, -4, 10].map((signedPercent) => ({ signedPercent, absolutePercent: Math.abs(signedPercent) }));
    expect(realizedMoveStats(observations, 4)).toEqual({ count: 4, averageSignedPercent: -0.5, averageAbsolutePercent: 2.5 });
  });
});
