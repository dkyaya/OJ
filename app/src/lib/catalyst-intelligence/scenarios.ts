import { scenarioSpreadValue, type VerticalValueInput } from './pricing';
import type { ScenarioInput, ScenarioResult } from './types';

export function probabilitiesAreValid(scenarios: ScenarioInput[]) {
  return scenarios.length > 0 && scenarios.every((item) => Number.isFinite(item.probability) && item.probability >= 0 && item.probability <= 100) && Math.abs(scenarios.reduce((sum, item) => sum + item.probability, 0) - 100) < 0.0001;
}

export function earlyEntryAssessment(expectedValue: number, maxLoss: number) {
  if (!Number.isFinite(expectedValue) || !Number.isFinite(maxLoss) || maxLoss <= 0) return { label: 'Insufficient' as const, ratio: undefined, rationale: 'A valid scenario EV and maximum loss are required.' };
  const ratio = expectedValue / maxLoss;
  if (ratio >= 0.1) return { label: 'Attractive' as const, ratio, rationale: 'Scenario EV is at least 10% of defined maximum risk.' };
  if (ratio < -0.05) return { label: 'Expensive' as const, ratio, rationale: 'Scenario EV is below -5% of defined maximum risk.' };
  return { label: 'Fairly Priced' as const, ratio, rationale: 'Scenario EV falls between -5% and 10% of defined maximum risk.' };
}

export function evaluateScenarios(currentSpot: number, scenarios: ScenarioInput[], base: Omit<VerticalValueInput, 'spot' | 'volatility' | 'timeYears'>, now: Date, expiration: Date) {
  if (!Number.isFinite(currentSpot) || currentSpot <= 0 || !probabilitiesAreValid(scenarios) || Number.isNaN(now.getTime()) || Number.isNaN(expiration.getTime())) return undefined;
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    const evaluationDate = new Date(scenario.evaluationDate);
    const scenarioPrice = scenario.targetPrice ?? (scenario.movePercent === undefined ? NaN : currentSpot * (1 + scenario.movePercent / 100));
    const timeYears = Math.max(0, (expiration.getTime() - evaluationDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
    if (!Number.isFinite(scenarioPrice) || scenarioPrice <= 0 || Number.isNaN(evaluationDate.getTime()) || evaluationDate < now || evaluationDate > expiration || !Number.isFinite(scenario.targetIv) || scenario.targetIv < 0) return undefined;
    const value = scenarioSpreadValue({ ...base, spot: scenarioPrice, volatility: scenario.targetIv, timeYears });
    if (!value) return undefined;
    results.push({ ...scenario, scenarioPrice, theoreticalValue: value.theoreticalValue, profitLoss: value.profitLoss, returnOnRisk: value.returnOnRisk, weightedContribution: value.profitLoss * scenario.probability / 100 });
  }
  return { results, expectedValue: results.reduce((sum, item) => sum + item.weightedContribution, 0), methodology: 'User-supplied scenario probabilities applied to CRR theoretical vertical values.' };
}
