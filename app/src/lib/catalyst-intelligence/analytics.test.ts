import { describe, expect, it } from 'vitest';
import { calibrationStats, dataQuality, estimatedEventPremium, incrementalEventVariance, ivContext, midpoint, realizedMove, straddleImpliedMove, volatilityImpliedMove } from './analytics';

describe('catalyst intelligence analytics', () => {
  it('calculates quote, straddle, and volatility move estimates', () => {
    expect(midpoint(1, 1.4)).toBeCloseTo(1.2);
    expect(midpoint(1.4, 1)).toBeUndefined();
    expect(straddleImpliedMove(3, 2, 100)).toEqual({ dollarMove: 5, percentMove: 5 });
    expect(volatilityImpliedMove(100, 0.2, 365)).toEqual({ dollarMove: 20, percentMove: 20 });
  });

  it('keeps IV rank and percentile methodologically distinct', () => {
    expect(ivContext(0.3, [0.1, 0.2, 0.4, 0.5])).toEqual({ currentIv: 0.3, low: 0.1, high: 0.5, count: 4, rank: 49.99999999999999, percentile: 50 });
    expect(ivContext(0.3, [0.3])).toBeUndefined();
  });

  it('calculates realized movement and incremental variance conservatively', () => {
    expect(realizedMove(100, 95)).toEqual({ signedPercent: -5, absolutePercent: 5 });
    const variance = incrementalEventVariance(0.3, 30, 0.2, 20);
    expect(variance?.incrementalVariance).toBeCloseTo((0.3 ** 2 * 30 - 0.2 ** 2 * 20) / 365);
    expect(incrementalEventVariance(0.1, 30, 0.5, 20)).toBeUndefined();
    expect(estimatedEventPremium(0.01, 0.2, 5)?.estimatedEventVariance).toBeCloseTo(0.01 - 0.2 ** 2 * 5 / 365);
  });

  it('reports calibration sample size without claiming statistical certainty', () => {
    expect(calibrationStats([{ impliedMove: 4, realizedMove: 5 }, { impliedMove: 3, realizedMove: 2, preEventDrift: -1 }])).toEqual({ count: 2, averageImpliedMove: 3.5, averageRealizedMove: 3.5, averageAbsoluteError: 1, exceedanceRate: 50, averagePreEventDrift: -1 });
    expect(dataQuality({ sourceQuality: 'official', freshness: 'historical', sampleCount: 8, requiredFieldsPresent: 4, requiredFieldCount: 4 })).toBe('strong');
    expect(dataQuality({ sourceQuality: 'unverified', freshness: 'manual', sampleCount: 1, requiredFieldsPresent: 1, requiredFieldCount: 4 })).toBe('insufficient');
  });
});
