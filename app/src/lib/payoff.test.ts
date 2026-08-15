import { describe, expect, it } from 'vitest';
import { allocationPercent, breakEven, bullCallPayoff, portfolioRisk, processScore, riskCapacityState, spreadMetrics } from './payoff';

describe('defined-risk spread math', () => {
  it('calculates bull-call break-even and payoff', () => {
    expect(breakEven(100, 0.45)).toBe(100.45);
    expect(bullCallPayoff(110, 100, 101, 0.45)).toBeCloseTo(0.55);
    expect(bullCallPayoff(90, 100, 101, 0.45)).toBeCloseTo(-0.45);
  });

  it('calculates flexible quantities only when contracts are explicit', () => {
    expect(spreadMetrics('bull-call-spread', 100, 102, 0.5, 2)).toEqual({ width: 2, maxLoss: 100, maxProfit: 300, breakEven: 100.5, rewardToRisk: 3 });
    expect(spreadMetrics('bull-call-spread', 100, 102, 0.5, undefined)).toBeNull();
  });

  it('calculates bear-put metrics with the correct strike direction', () => {
    expect(spreadMetrics('bear-put-spread', 100, 95, 2, 1)).toMatchObject({ breakEven: 98, maxLoss: 200, maxProfit: 300 });
    expect(spreadMetrics('bear-put-spread', 95, 100, 2, 1)).toBeNull();
  });

  it('rejects malformed values', () => expect(spreadMetrics('bull-call-spread', 100, 100, 1, 1)).toBeNull());
  it('rejects a zero debit or debit equal to spread width', () => {
    expect(spreadMetrics('bull-call-spread', 100, 102, 0, 1)).toBeNull();
    expect(spreadMetrics('bull-call-spread', 100, 102, 2, 1)).toBeNull();
  });
});

describe('portfolio capacity and process', () => {
  it('sums only actual open defined-risk positions and warns on correlation clusters', () => {
    const result = portfolioRisk([
      { maxLoss: 200, correlationCluster: 'broad-index', isOpen: true },
      { maxLoss: 200, correlationCluster: 'broad-index', isOpen: true },
      { maxLoss: 90, correlationCluster: 'energy', isOpen: false },
    ], 400);
    expect(result.totalRisk).toBe(400);
    expect(result.availableRisk).toBe(0);
    expect(result.state).toBe('near-capacity');
    expect(result.correlatedClusters).toEqual([{ name: 'broad-index', risk: 400 }]);
  });

  it('uses normal, elevated, near-capacity, and blocked visual states', () => {
    expect(riskCapacityState(200, 400)).toBe('normal');
    expect(riskCapacityState(201, 400)).toBe('elevated');
    expect(riskCapacityState(301, 400)).toBe('near-capacity');
    expect(riskCapacityState(401, 400)).toBe('blocked');
    expect(allocationPercent(50, 200)).toBe(25);
  });

  it('keeps process separate from outcome', () => {
    expect(processScore([5, 4, 5, 4, 5, 4, 5])).toBe(91);
    expect(processScore([0, 5])).toBeNull();
  });
});
