export type Spread = 'bull-call-spread' | 'bear-put-spread';

export type SpreadMetrics = {
  width: number;
  maxLoss: number;
  maxProfit: number;
  breakEven: number;
  rewardToRisk: number | null;
};

export type OpenRiskPosition = {
  maxLoss: number | null | undefined;
  correlationCluster?: string | null;
  isOpen: boolean;
};

export type RiskCapacityState = 'normal' | 'elevated' | 'near-capacity' | 'blocked';

export const bullCallPayoff = (price: number, longStrike: number, shortStrike: number, debit: number) =>
  Math.min(Math.max(price - longStrike, 0), shortStrike - longStrike) - debit;

export const breakEven = (longStrike: number, debit: number) => longStrike + debit;

export function spreadMetrics(
  strategy: Spread,
  longStrike: number,
  shortStrike: number,
  debit: number,
  contracts: number | null | undefined,
): SpreadMetrics | null {
  const quantity = typeof contracts === 'number' && Number.isInteger(contracts) && contracts > 0 ? contracts : null;
  if (![longStrike, shortStrike, debit].every(Number.isFinite) || quantity === null || debit < 0) return null;
  const validDirection = strategy === 'bull-call-spread' ? shortStrike > longStrike : longStrike > shortStrike;
  const width = Math.abs(shortStrike - longStrike);
  if (!validDirection || width <= 0 || debit > width) return null;
  return {
    width,
    maxLoss: debit * 100 * quantity,
    maxProfit: (width - debit) * 100 * quantity,
    breakEven: strategy === 'bull-call-spread' ? longStrike + debit : longStrike - debit,
    rewardToRisk: debit === 0 ? null : (width - debit) / debit,
  };
}

export const allocationPercent = (risk: number, allocation: number) => (allocation > 0 && risk >= 0 ? (risk / allocation) * 100 : null);

export function riskCapacityState(totalRisk: number, capacity: number): RiskCapacityState | null {
  if (!Number.isFinite(totalRisk) || !Number.isFinite(capacity) || capacity <= 0 || totalRisk < 0) return null;
  const percent = (totalRisk / capacity) * 100;
  if (percent > 100) return 'blocked';
  if (percent > 75) return 'near-capacity';
  if (percent > 50) return 'elevated';
  return 'normal';
}

export function portfolioRisk(positions: OpenRiskPosition[], capacity: number | null | undefined) {
  const totalRisk = positions.reduce((sum, position) => (position.isOpen && Number.isFinite(position.maxLoss) && (position.maxLoss ?? 0) >= 0 ? sum + (position.maxLoss ?? 0) : sum), 0);
  const clusters = new Map<string, number>();
  positions.forEach((position) => {
    if (!position.isOpen || !Number.isFinite(position.maxLoss) || (position.maxLoss ?? 0) < 0 || !position.correlationCluster) return;
    clusters.set(position.correlationCluster, (clusters.get(position.correlationCluster) || 0) + (position.maxLoss ?? 0));
  });
  const validCapacity = Number.isFinite(capacity) && (capacity ?? 0) > 0 ? capacity ?? null : null;
  return {
    totalRisk,
    availableRisk: validCapacity === null ? null : validCapacity - totalRisk,
    capacityPercent: validCapacity === null ? null : allocationPercent(totalRisk, validCapacity),
    state: validCapacity === null ? null : riskCapacityState(totalRisk, validCapacity),
    correlatedClusters: [...clusters.entries()].filter(([, risk]) => risk > 0).map(([name, risk]) => ({ name, risk })),
  };
}

export const processScore = (ratings: number[]) =>
  ratings.length && ratings.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 20)
    : null;
