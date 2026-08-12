import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { filterCatalysts } from './catalyst-filter';

describe('filterCatalysts', () => {
  it('combines horizon, certainty, ticker, and cluster filters', () => {
    const result = filterCatalysts(demoWorkspace.catalysts, { horizon: 7, category: 'Employment', certainty: 'confirmed', ticker: 'demo', cluster: 'macro' }, '2026-08-10');
    expect(result.map((item) => item.event)).toEqual(['Employment release']);
  });

  it('keeps contextual risk out of dated horizons', () => {
    const contextual = { ...demoWorkspace.catalysts[0], id: 'context', date: undefined, scheduleKind: 'contextual' as const, dateCertainty: 'contextual' as const };
    expect(filterCatalysts([contextual], { horizon: 30, category: 'all', certainty: 'all', ticker: '', cluster: '' }, '2026-08-10')).toEqual([]);
  });
});
