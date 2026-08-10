import { describe, expect, it } from 'vitest';
import { cloudRowToDraft, shouldRejectMissingCanonical } from './cloud';

describe('canonical cloud hydration', () => {
  it('maps Supabase records to a canonical local cache entry', () => {
    const draft = cloudRowToDraft({ id: '11111111-1111-4111-8111-111111111111', data: { Ticker: 'DEMO' }, revision: 4, sync_status: 'cloud_draft', updated_at: '2026-08-08T12:00:00Z' }, 'user-a');
    expect(draft.sync).toBe('canonical'); expect(draft.cloudRevision).toBe(4); expect(draft.data.Ticker).toBe('DEMO'); expect(draft.ownerId).toBe('user-a');
  });

  it('does not treat optional mirror state as application authority', () => {
    const draft = cloudRowToDraft({ id: '22222222-2222-4222-8222-222222222222', data: {}, revision: 2, sync_status: 'failed', mirror_status: 'failed', updated_at: '2026-08-08T12:00:00Z' }, 'user-b');
    expect(draft.sync).toBe('canonical'); expect(draft.cloudRevision).toBe(2);
  });

  it('distinguishes a stale deleted record from a never-synced new draft', () => {
    const canonical = cloudRowToDraft({ id: '33333333-3333-4333-8333-333333333333', data: {}, revision: 3, updated_at: '2026-08-08T12:00:00Z' }, 'user-c');
    expect(shouldRejectMissingCanonical(canonical)).toBe(true);
    expect(shouldRejectMissingCanonical({ ...canonical, cloudRevision: undefined, sync: 'local' })).toBe(false);
  });
});
