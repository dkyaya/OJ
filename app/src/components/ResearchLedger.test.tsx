import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import type { MarketSnapshot } from '../lib/catalyst-intelligence/types';
import { ResearchLedger } from './ResearchLedger';

const chain: MarketSnapshot[] = (['call', 'put'] as const).map((optionSide) => ({
  provider: 'fixture-provider', sourceQuality: 'secondary', observedAt: '2026-08-13T13:00:00Z', fetchedAt: '2026-08-13T13:05:00Z', freshness: 'delayed',
  ticker: 'SYNTH', underlyingPrice: 100, expiration: '2026-09-18', optionSide, strike: 100, bid: 1, ask: 1.4,
  methodology: 'Synthetic ledger fixture.', provenance: 'provider',
}));

describe('ResearchLedger snapshot presentation', () => {
  it('uses the structured option-chain reader and exposes a safe removal action', () => {
    const providerSnapshot = { ...demoWorkspace.researchSnapshots[0], id: 'provider-fixture', ticker: 'SYNTH', provider: 'fixture-provider', freshness: 'delayed' as const, values: { option_chain: chain } };
    const markup = renderToStaticMarkup(<ResearchLedger workspace={{ ...demoWorkspace, researchSnapshots: [providerSnapshot] }} catalystId={providerSnapshot.catalystId} onSaved={() => undefined} />);
    expect(markup).toContain('Paired option chain');
    expect(markup).toContain('Call Bid');
    expect(markup).toContain('Remove Snapshot');
    expect(markup).toContain('Technical Details');
    expect(markup).not.toContain('Option Chain: [{');
  });

  it('lists removed snapshots separately with reason and restore control', () => {
    const original = demoWorkspace.researchSnapshots[0];
    const markup = renderToStaticMarkup(<ResearchLedger workspace={{ ...demoWorkspace, researchSnapshots: [], removedResearchSnapshots: [{ snapshot: original, removal: { id: 'event', eventOrder: 1, snapshotId: original.id, action: 'remove', reason: 'duplicate', createdAt: '2026-08-13T14:00:00Z' } }] }} catalystId={original.catalystId} onSaved={() => undefined} />);
    expect(markup).toContain('Removed Snapshots (1)');
    expect(markup).toContain('Removed for Duplicate');
    expect(markup).toContain('Restore');
  });

  it('distinguishes manual and delayed provider observations by timestamp and provenance', () => {
    const original = demoWorkspace.researchSnapshots[0];
    const manual = { ...original, id: 'manual-comparison', ticker: 'SYNTH', provider: 'manual', sourceReference: 'Manual screen', values: { expiration: '2026-09-18', event_implied_move_percent: 4.2 } };
    const provider = { ...original, id: 'provider-comparison', ticker: 'SYNTH', provider: 'fixture-provider', freshness: 'delayed' as const, sourceReference: undefined, values: { option_chain: chain } };
    const markup = renderToStaticMarkup(<ResearchLedger workspace={{ ...demoWorkspace, researchSnapshots: [manual, provider] }} catalystId={original.catalystId} onSaved={() => undefined} />);
    expect(markup).toContain('Manual / Provider Comparison');
    expect(markup).toContain('manual · Manual screen · manual');
    expect(markup).toContain('fixture-provider · delayed');
    expect(markup).toContain('Observed');
  });
});
