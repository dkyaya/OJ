import { describe, expect, it } from 'vitest';
import { earlyEntryAssessment, evaluateScenarios, probabilitiesAreValid } from './scenarios';
import type { ScenarioInput } from './types';

const scenarios: ScenarioInput[] = [
  { id: 'bull', label: 'Bull', probability: 25, movePercent: 5, targetIv: 0.25, evaluationDate: '2026-08-20' },
  { id: 'base', label: 'Base', probability: 50, movePercent: 0, targetIv: 0.25, evaluationDate: '2026-08-20' },
  { id: 'bear', label: 'Bear', probability: 25, movePercent: -5, targetIv: 0.25, evaluationDate: '2026-08-20' },
];

describe('scenario engine', () => {
  it('requires probabilities to total 100 before showing EV', () => {
    expect(probabilitiesAreValid(scenarios)).toBe(true);
    expect(probabilitiesAreValid(scenarios.map((item) => ({ ...item, probability: 20 })))).toBe(false);
  });

  it('produces transparent probability-weighted scenario values', () => {
    const result = evaluateScenarios(100, scenarios, { strategy: 'bull-call-spread', longStrike: 100, shortStrike: 105, debit: 2, contracts: 1, riskFreeRate: 0.04 }, new Date('2026-08-12'), new Date('2026-09-18'));
    expect(result?.results).toHaveLength(3);
    expect(result?.expectedValue).toBeCloseTo(result!.results.reduce((sum, item) => sum + item.profitLoss * item.probability / 100, 0));
  });

  it('makes the early-entry assessment thresholds explicit', () => {
    expect(earlyEntryAssessment(20, 100)).toMatchObject({ label: 'Attractive', ratio: 0.2 });
    expect(earlyEntryAssessment(-10, 100)).toMatchObject({ label: 'Expensive', ratio: -0.1 });
    expect(earlyEntryAssessment(0, 0).label).toBe('Insufficient');
  });
});
