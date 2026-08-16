import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import type { Position } from '../types/domain';
import { JournalPage } from './JournalPage';

const closedTrade: Position = {
  id: 'closed-synthetic', ideaId: demoWorkspace.ideas[0].id, ticker: 'DEMO', strategy: 'Bear Put Spread', status: 'closed', contracts: 1,
  maxRisk: 80, maxProfit: 220, breakEven: 99.2, expiration: '2026-09-18', longStrike: 100, shortStrike: 97, actualDebit: 0.8, entryFees: 0,
  tradeClass: 'post_catalyst_confirmation', originatingCatalystId: demoWorkspace.catalysts[0].id, exposureTags: ['macro-demo'], openedAt: '2026-08-13T14:00:00Z', closedAt: '2026-08-14T14:00:00Z', revision: 2, data: {},
  entryContext: { version: 1, capturedAt: '2026-08-13T14:00:00Z', ideaId: demoWorkspace.ideas[0].id, ideaRevision: 2, thesis: 'Original entry thesis.', invalidation: 'Original invalidation.', plannedExit: 'Original planned exit.', holdThroughEvents: [], avoidEvents: [], candidate: { id: 'candidate', revision: 1, plannedDebit: 0.85 }, originatingCatalystId: demoWorkspace.catalysts[0].id, linkedCatalysts: [], researchSnapshotIds: [demoWorkspace.researchSnapshots[0].id], forecastIds: [demoWorkspace.forecasts[0].id], exposureTags: [] },
  checkins: [{ id: 'checkin', tradeId: 'closed-synthetic', ideaId: demoWorkspace.ideas[0].id, thesisHealth: 'weaker', checkedAt: '2026-08-13T18:00:00Z', whatChanged: 'Synthetic reassessment.', priceChanged: true, catalystChanged: false, volatilityChanged: false, macroChanged: false, plannedExitState: 'reassess', invalidationOccurred: false, managementView: 'Current view changed.', data: {} }],
  exit: { id: 'exit', tradeId: 'closed-synthetic', ideaId: demoWorkspace.ideas[0].id, exitedAt: '2026-08-14T14:00:00Z', contractsExited: 1, exitValue: 1.2, exitValueType: 'credit', fees: 0, realizedPnl: 40, exitReason: 'target_reached', thesisHealth: 'intact', data: {} },
};

describe('Trade debrief continuity', () => {
  it('assembles facts, original plan, evolution, outcome, and research references', () => {
    const html = renderToStaticMarkup(<JournalPage workspace={{ ...demoWorkspace, positions: [closedTrade] }} initialTradeId={closedTrade.id} onSaved={() => undefined} />);
    expect(html).toContain('Facts');
    expect(html).toContain('data-shared-ui="debrief-editor"');
    expect(html).toContain('data-shared-ui="debrief-context"');
    expect(html).toContain('Original Plan');
    expect(html).toContain('Original entry thesis.');
    expect(html).toContain('Evolution');
    expect(html).toContain('Outcome');
    expect(html).toContain('2 entry research references');
    expect(html).toContain('Reflection remains yours to write');
  });

  it('keeps Trade Check-Ins out of the Journal feed while retaining Trade history', () => {
    const checkinOnlyWorkspace = {
      ...demoWorkspace,
      positions: [closedTrade],
      journal: [{ id: 'legacy-checkin', ideaId: closedTrade.ideaId, tradeId: closedTrade.id, kind: 'check-in' as const, createdAt: '2026-08-13T18:00:00Z', summary: 'Synthetic reassessment.', data: {} }],
    };
    const html = renderToStaticMarkup(<JournalPage workspace={checkinOnlyWorkspace} onSaved={() => undefined} />);
    expect(html).toContain('No Journal Debriefs');
    expect(html).toContain('Check-Ins remain with each Trade');
    expect(html).not.toContain('Trade Check-In');
    expect(html).not.toContain('Synthetic reassessment.');
  });

  it('still renders a user-authored Trade Debrief', () => {
    const reviewWorkspace = { ...demoWorkspace, positions: [closedTrade], journal: [{ id: 'review', ideaId: closedTrade.ideaId, tradeId: closedTrade.id, kind: 'review' as const, createdAt: '2026-08-14T15:00:00Z', summary: 'A deliberate process review.', data: {} }] };
    const html = renderToStaticMarkup(<JournalPage workspace={reviewWorkspace} onSaved={() => undefined} />);
    expect(html).toContain('Trade Debrief');
    expect(html).toContain('A deliberate process review.');
    expect(html).toContain('Linked Trade Story');
  });
});
