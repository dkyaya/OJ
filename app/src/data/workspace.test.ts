import { describe, expect, it } from 'vitest';
import { activeIdeaOpportunities, journalDebriefsFromRows } from './workspace';

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

describe('Journal presentation boundary', () => {
  it('builds the Journal feed from debrief rows only', () => {
    const rows = [
      { id: 'older-review', trade_idea_id: 'idea', trade_id: 'trade', created_at: '2026-08-14T12:00:00Z', data: { Summary: 'First debrief.' } },
      { id: 'newer-review', trade_idea_id: 'idea', trade_id: 'trade', created_at: '2026-08-15T12:00:00Z', data: { Lesson: 'Newest lesson.' } },
    ];
    expect(journalDebriefsFromRows(rows).map((item) => [item.id, item.kind, item.summary])).toEqual([
      ['newer-review', 'review', 'Newest lesson.'],
      ['older-review', 'review', 'First debrief.'],
    ]);
  });
});
