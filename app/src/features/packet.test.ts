import { describe, expect, it } from 'vitest';
import { packet } from './packet';

describe('fallback packet', () => {
  it('flattens multiline fields and describes Supabase recovery', () => {
    const text = packet({ id: '1', ownerId: 'user-a', kind: 'trade_idea', data: { Ticker: 'DEMO\nunsafe heading', Missing: '' }, updatedAt: '2026-08-04T00:00:00Z', sync: 'local' });
    expect(text).toContain('Ticker: DEMO unsafe heading'); expect(text).toContain('Missing: TBD'); expect(text).toContain('canonical Supabase record'); expect(text).toContain('No brokerage access');
  });
});
