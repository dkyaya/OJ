import type { Catalyst, CatalystDateCertainty } from '../types/domain';

export type CatalystFilters = {
  horizon: 3 | 7 | 14 | 30 | 'all';
  category: string;
  certainty: CatalystDateCertainty | 'all';
  ticker: string;
  cluster: string;
};

const dayNumber = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

export function filterCatalysts(catalysts: Catalyst[], filters: CatalystFilters, today: string) {
  const start = dayNumber(today);
  const ticker = filters.ticker.trim().toUpperCase();
  const cluster = filters.cluster.trim().toLowerCase();
  return catalysts.filter((item) => {
    if (filters.horizon !== 'all') {
      if (!item.date || item.scheduleKind === 'contextual') return false;
      const distance = dayNumber(item.date) - start;
      if (distance < 0 || distance > filters.horizon) return false;
    }
    if (filters.category !== 'all' && (item.category || item.type) !== filters.category) return false;
    if (filters.certainty !== 'all' && item.dateCertainty !== filters.certainty) return false;
    if (ticker && !item.linkedTickers.some((itemTicker) => itemTicker.toUpperCase().includes(ticker))) return false;
    if (cluster && !item.cluster?.toLowerCase().includes(cluster)) return false;
    return true;
  });
}
