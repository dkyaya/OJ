import { describe, expect, it } from 'vitest';
import { calibrationStats, ivContext } from './catalyst-intelligence/analytics';
import { partitionResearchSnapshots } from './research-snapshot-lifecycle';
import type { ResearchSnapshot, ResearchSnapshotLifecycleEvent } from '../types/domain';

const snapshot = (id: string, sessionLabel: ResearchSnapshot['sessionLabel'], iv: number): ResearchSnapshot => ({
  id, catalystId: 'catalyst', snapshotType: 'event_implied_move', ticker: 'SYNTH', observedAt: `2026-08-${id === 'a' ? '10' : id === 'b' ? '11' : '12'}T16:00:00Z`,
  methodology: 'Synthetic lifecycle test.', values: { implied_volatility: iv, event_implied_move_percent: iv * 10, realized_move_percent: iv * 8 },
  provider: 'manual', sourceQuality: 'unverified', freshness: 'manual', fetchedAt: '2026-08-12T17:00:00Z', sessionLabel,
});

const event = (id: string, snapshotId: string, action: ResearchSnapshotLifecycleEvent['action'], createdAt: string, eventOrder = Number(createdAt.slice(11, 13))): ResearchSnapshotLifecycleEvent => ({
  id, eventOrder, snapshotId, action, reason: action === 'remove' ? 'test_snapshot' : undefined, createdAt,
});

describe('research snapshot lifecycle partition', () => {
  const snapshots = [snapshot('a', 'T-3', 0.2), snapshot('b', 'T-1', 0.3), snapshot('c', 'T0', 0.4)];

  it('excludes removed observations from history, calibration, IV context, and timeline counts', () => {
    const partitioned = partitionResearchSnapshots(snapshots, [event('remove-c', 'c', 'remove', '2026-08-13T10:00:00Z')]);
    expect(partitioned.active.map((item) => item.id)).toEqual(['a', 'b']);
    expect(partitioned.removed.map((item) => item.snapshot.id)).toEqual(['c']);
    expect(calibrationStats(partitioned.active.map((item) => ({ impliedMove: Number(item.values.event_implied_move_percent), realizedMove: Number(item.values.realized_move_percent) })))?.count).toBe(2);
    expect(ivContext(0.3, partitioned.active.map((item) => Number(item.values.implied_volatility)))?.count).toBe(2);
    expect(partitioned.active.filter((item) => item.sessionLabel === 'T0')).toHaveLength(0);
  });

  it('restores the exact original observation only after an explicit later restore event', () => {
    const partitioned = partitionResearchSnapshots(snapshots, [
      event('remove-c', 'c', 'remove', '2026-08-13T10:00:00Z'),
      event('restore-c', 'c', 'restore', '2026-08-13T11:00:00Z'),
    ]);
    expect(partitioned.active).toEqual(snapshots);
    expect(partitioned.removed).toEqual([]);
    expect(calibrationStats(partitioned.active.map((item) => ({ impliedMove: Number(item.values.event_implied_move_percent), realizedMove: Number(item.values.realized_move_percent) })))?.count).toBe(3);
  });

  it('keeps a stale snapshot removed after the workspace refreshes the latest event state', () => {
    const partitioned = partitionResearchSnapshots(snapshots, [event('remove-b', 'b', 'remove', '2026-08-13T12:00:00Z')]);
    expect(partitioned.active.some((item) => item.id === 'b')).toBe(false);
  });
});
