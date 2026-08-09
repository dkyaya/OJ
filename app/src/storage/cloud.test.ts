import { describe, expect, it } from 'vitest';
import { cloudRowToDraft } from './cloud';

describe('canonical cloud hydration', () => {
  it('maps Supabase records to a canonical local cache entry', () => {
    const draft = cloudRowToDraft({ id: '11111111-1111-4111-8111-111111111111', data: { Ticker: 'DEMO' }, revision: 4, sync_status: 'cloud_draft', updated_at: '2026-08-08T12:00:00Z' });
    expect(draft.sync).toBe('canonical'); expect(draft.cloudRevision).toBe(4); expect(draft.data.Ticker).toBe('DEMO');
  });

  it('does not treat optional mirror state as application authority', () => {
    const draft = cloudRowToDraft({ id: '22222222-2222-4222-8222-222222222222', data: {}, revision: 2, sync_status: 'failed', mirror_status: 'failed', updated_at: '2026-08-08T12:00:00Z' });
    expect(draft.sync).toBe('canonical'); expect(draft.cloudRevision).toBe(2);
  });
});
