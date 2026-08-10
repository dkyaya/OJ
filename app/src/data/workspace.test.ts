import { describe, expect, it } from 'vitest';
import { activeIdeaOpportunities } from './workspace';

describe('archived idea suppression', () => {
  it('keeps general catalyst mappings but removes archived-idea mappings from active views', () => {
    const items = [
      { id: 'general', catalystId: 'cat', ticker: 'SPY', exposure: 'index', scores: {} },
      { id: 'active', catalystId: 'cat', ideaId: 'active-idea', ticker: 'SPY', exposure: 'index', scores: {} },
      { id: 'archived', catalystId: 'cat', ideaId: 'archived-idea', ticker: 'ARCHIVE', exposure: 'index', scores: {} },
    ];
    expect(activeIdeaOpportunities(items, new Set(['archived-idea'])).map((item) => item.id)).toEqual(['general', 'active']);
  });
});
