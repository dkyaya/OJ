import { describe, expect, it } from 'vitest';
import { cloudRowToDraft } from './cloud';

describe('cloud hydration', () => {
  it('maps published metadata without exposing a second canonical record', () => {
    const draft = cloudRowToDraft({
      id: '11111111-1111-4111-8111-111111111111',
      data: { Ticker: 'SPY' },
      revision: 4,
      sync_status: 'published',
      updated_at: '2026-08-04T12:00:00Z',
      published_note_path: 'Trade Ideas/SPY.md',
      published_commit_sha: 'abc123',
    });
    expect(draft.sync).toBe('published');
    expect(draft.cloudRevision).toBe(4);
    expect(draft.canonicalNotePath).toBe('Trade Ideas/SPY.md');
    expect(draft.data.Ticker).toBe('SPY');
  });

  it('maps failed server work to an actionable retry state', () => {
    const draft = cloudRowToDraft({
      id: '22222222-2222-4222-8222-222222222222',
      data: {},
      revision: 1,
      sync_status: 'failed',
      updated_at: '2026-08-04T12:00:00Z',
    });
    expect(draft.sync).toBe('retry');
  });
});
