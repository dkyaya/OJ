import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { TradesPage } from './TradesPage';
import { tradeCardFacts } from '../lib/card-presentation';
import { TradeExitEditor } from '../components/editors/TradeLifecycleEditors';
import type { Position } from '../types/domain';

const activeTrade: Position = {
  id: 'synthetic-trade', ideaId: demoWorkspace.ideas[0].id, ticker: 'DEMO', strategy: 'Bear Put Spread', status: 'active', contracts: 1,
  maxRisk: 75, maxProfit: 225, breakEven: 99.25, expiration: '2026-09-18', longStrike: 100, shortStrike: 97, actualDebit: 0.75,
  entryFees: 0.5, candidateId: demoWorkspace.ideas[0].candidates[0].id, tradeClass: 'pre_catalyst_anticipation', originatingCatalystId: demoWorkspace.catalysts[0].id,
  exposureTags: ['macro-demo'], checkins: [], openedAt: '2026-08-13T14:00:00Z', revision: 1, data: {},
  entryContext: {
    version: 1, capturedAt: '2026-08-13T14:00:00Z', ideaId: demoWorkspace.ideas[0].id, ideaRevision: 2, thesis: 'Original synthetic entry thesis.',
    invalidation: 'Original invalidation.', plannedExit: 'Exit before the event.', holdThroughEvents: [], avoidEvents: ['Employment release'],
    candidate: { id: demoWorkspace.ideas[0].candidates[0].id, revision: 1, expiration: '2026-09-18', longStrike: 100, shortStrike: 97, plannedDebit: 0.8, plannedContracts: 1 },
    actual: { expiration: '2026-09-18', longStrike: 100, shortStrike: 97, contracts: 1, debit: 0.75, fees: 0.5, maxLoss: 75, maxProfit: 225, breakEven: 99.25 },
    originatingCatalystId: demoWorkspace.catalysts[0].id, linkedCatalysts: [{ catalystId: demoWorkspace.catalysts[0].id, relationship: 'primary' }],
    researchSnapshotIds: [demoWorkspace.researchSnapshots[0].id], forecastIds: [demoWorkspace.forecasts[0].id], tradeClass: 'pre_catalyst_anticipation', exposureTags: ['macro-demo'],
  },
};

describe('Trade workflow presentation', () => {
  it('opens Record Trade from a qualified Idea with Candidate values prepopulated', () => {
    const html = renderToStaticMarkup(<TradesPage workspace={demoWorkspace} initialIdeaId={demoWorkspace.ideas[0].id} onSaved={() => undefined} onDebrief={() => undefined} />);
    expect(html).toContain('Record Trade');
    expect(html).toContain('data-shared-ui="record-trade-editor"');
    expect(html).toContain('Actual Expiration');
    expect(html).toContain('value="2026-09-18"');
    expect(html).toContain('Planned Candidate');
    expect(html).toContain('Actual Trade');
    expect(html).toContain('I confirm this is an actual fill executed outside OJ.');
    expect(html).toContain('>Record Trade<');
  });

  it('preserves the production exit attestation and action copy', () => {
    const html = renderToStaticMarkup(<TradeExitEditor position={activeTrade} onCancel={() => undefined} onSave={() => undefined} />);
    expect(html).toContain('I confirm this is the actual full closing transaction.');
    expect(html).toContain('>Record Exit &amp; Debrief<');
  });

  it('distinguishes OJ policy capacity from brokerage buying power', () => {
    const html = renderToStaticMarkup(<TradesPage workspace={{ ...demoWorkspace, policy: { ...demoWorkspace.policy!, maximumOpenRisk: 650 } }} onSaved={() => undefined} onDebrief={() => undefined} />);
    expect(html).toContain('OJ Risk Ceiling');
    expect(html).toContain('$650.00');
    expect(html).toContain('Not brokerage buying power');
  });

  it('keeps the original plan, actual execution, and entry research together', () => {
    const html = renderToStaticMarkup(<TradesPage workspace={{ ...demoWorkspace, positions: [activeTrade] }} onSaved={() => undefined} onDebrief={() => undefined} />);
    expect(html).toContain('Original synthetic entry thesis.');
    expect(html).toContain('data-shared-ui="trade-detail-surface"');
    expect(html).toContain('Planned Candidate at Entry');
    expect(html).toContain('Actual Execution');
    expect(html).toContain('Locked Forecast');
    expect(html).toContain('Research Context');
  });

  it('keeps a Trade Check-In in monitoring and history', () => {
    const withCheckin: Position = { ...activeTrade, checkins: [{ id: 'checkin', tradeId: activeTrade.id, ideaId: activeTrade.ideaId, thesisHealth: 'weaker', checkedAt: '2026-08-14T14:00:00Z', whatChanged: 'Synthetic Trade monitoring update.', priceChanged: true, catalystChanged: false, volatilityChanged: false, macroChanged: false, plannedExitState: 'reassess', invalidationOccurred: false, managementView: 'Wait for confirmation.', data: {} }] };
    const html = renderToStaticMarkup(<TradesPage workspace={{ ...demoWorkspace, positions: [withCheckin] }} onSaved={() => undefined} onDebrief={() => undefined} />);
    expect(html).toContain('Current Monitoring');
    expect(html).toContain('Synthetic Trade monitoring update.');
    expect(html).toContain('Wait for confirmation.');
    expect(html).toContain('Add Check-In');
  });

  it('summarizes thesis health, expiration, and the next linked catalyst at a glance', () => {
    const withCheckin: Position = { ...activeTrade, checkins: [{ id: 'checkin', tradeId: activeTrade.id, ideaId: activeTrade.ideaId, thesisHealth: 'weaker', checkedAt: '2026-08-14T14:00:00Z', whatChanged: 'Synthetic update.', priceChanged: true, catalystChanged: false, volatilityChanged: false, macroChanged: false, plannedExitState: 'reassess', invalidationOccurred: false, managementView: 'Wait.', data: {} }] };
    const facts = tradeCardFacts(withCheckin, demoWorkspace, new Date('2026-08-13T12:00:00Z'));
    expect(facts).toEqual({ thesis: 'Weaker', catalyst: 'Employment release · 2026-08-14', expiration: '2026-09-18' });
    const html = renderToStaticMarkup(<TradesPage workspace={{ ...demoWorkspace, positions: [withCheckin] }} onSaved={() => undefined} onDebrief={() => undefined} />);
    expect(html).toContain('Thesis health');
    expect(html).toContain('Next catalyst');
    expect(html).toContain('Expires 2026-09-18');
  });
});
