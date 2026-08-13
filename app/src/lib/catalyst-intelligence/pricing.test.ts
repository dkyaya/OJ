import { describe, expect, it } from 'vitest';
import { binomialOptionPrice, impliedVolatilityFromPrice, scenarioSpreadValue } from './pricing';

describe('catalyst intelligence pricing', () => {
  it('converges near a standard European call reference value', () => {
    const value = binomialOptionPrice({ spot: 100, strike: 100, timeYears: 1, volatility: 0.2, riskFreeRate: 0.05, dividendYield: 0, side: 'call', style: 'european', steps: 500 });
    expect(value).toBeCloseTo(10.45, 1);
  });

  it('solves IV from a model-consistent price', () => {
    const base = { spot: 100, strike: 105, timeYears: 0.5, riskFreeRate: 0.03, dividendYield: 0, side: 'call' as const, style: 'european' as const, steps: 300 };
    const price = binomialOptionPrice({ ...base, volatility: 0.28 });
    expect(price).toBeDefined();
    expect(impliedVolatilityFromPrice(price!, base)).toBeCloseTo(0.28, 3);
    expect(impliedVolatilityFromPrice(200, base)).toBeUndefined();
  });

  it('uses exact expiration payoff and existing vertical economics', () => {
    const value = scenarioSpreadValue({ strategy: 'bull-call-spread', spot: 110, longStrike: 100, shortStrike: 105, debit: 2, contracts: 1, timeYears: 0, volatility: 0.2, riskFreeRate: 0.04 });
    expect(value?.theoreticalValue).toBe(5);
    expect(value?.profitLoss).toBe(300);
    expect(value?.economics.maxLoss).toBe(200);
  });

  it('fails safely for invalid model inputs', () => {
    expect(binomialOptionPrice({ spot: -1, strike: 100, timeYears: 1, volatility: 0.2, riskFreeRate: 0.05, side: 'call' })).toBeUndefined();
    expect(scenarioSpreadValue({ strategy: 'bull-call-spread', spot: 100, longStrike: 105, shortStrike: 100, debit: 1, timeYears: 0, volatility: 0.2, riskFreeRate: 0.04 })).toBeUndefined();
  });
});
