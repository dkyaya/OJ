import type { TradingSessionLabel } from './types';

const anchors = new Map<number, TradingSessionLabel>([[-5, 'T-5'], [-3, 'T-3'], [-1, 'T-1'], [0, 'T0'], [1, 'T+1'], [5, 'T+5']]);

export function tradingSessionLabel(observedSession: string, catalystSession: string, orderedTradingSessions: string[]) {
  const unique = [...new Set(orderedTradingSessions)].sort();
  const eventIndex = unique.indexOf(catalystSession);
  const observedIndex = unique.indexOf(observedSession);
  if (eventIndex < 0 || observedIndex < 0) return undefined;
  return anchors.get(observedIndex - eventIndex);
}

export const sessionDefinitions: Record<TradingSessionLabel, string> = {
  'T-5': 'Five completed trading sessions before the catalyst session.',
  'T-3': 'Three completed trading sessions before the catalyst session.',
  'T-1': 'Final completed trading session before the catalyst session.',
  T0: 'Catalyst session.',
  'T+1': 'Next completed trading session after the catalyst.',
  'T+5': 'Fifth completed trading session after the catalyst.',
};
