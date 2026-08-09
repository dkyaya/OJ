import type { Workspace } from '../types/domain';

export const demoWorkspace: Workspace = {
  authenticated: true,
  approved: true,
  demo: true,
  policy: { totalCapital: 5000, maximumOpenRisk: 500, strategies: ['bull-call-spread', 'bear-put-spread'], effectiveDate: '2026-08-01', version: 1 },
  preferences: { theme: 'dark', calendarView: 'month', compactCards: false, revision: 1 },
  ideas: [
    {
      id: '10000000-0000-4000-8000-000000000001', ticker: 'DEMO', strategy: 'Bear Put Spread', bias: 'Bearish', status: 'watchlist', confidence: 'Moderate',
      thesis: 'Synthetic setup used only for interface validation.', entryConditions: 'Wait for the scheduled release.', invalidation: 'Price holds above the research range.',
      plannedExit: 'Close before expiration.', catalystId: '20000000-0000-4000-8000-000000000001', risk: 80, updatedAt: '2026-08-08T12:00:00Z', revision: 2,
      candidates: [{ id: '30000000-0000-4000-8000-000000000001', name: 'Balanced', longStrike: 100, shortStrike: 97, debit: 0.8, contracts: 1, maxLoss: 80, maxProfit: 220, breakEven: 99.2 }], data: {},
    },
    {
      id: '10000000-0000-4000-8000-000000000002', ticker: 'SAMPLE', strategy: 'Bull Call Spread', bias: 'Bullish', status: 'deferred',
      thesis: 'Synthetic deferred research.', updatedAt: '2026-08-06T12:00:00Z', revision: 1, candidates: [], data: {},
    },
  ],
  catalysts: [
    { id: '20000000-0000-4000-8000-000000000001', event: 'Employment release', type: 'Employment', date: '2026-08-14', sensitivity: 'High', status: 'Scheduled', source: 'Synthetic source', cluster: 'macro-demo', linkedTickers: ['DEMO'], revision: 1, data: {} },
    { id: '20000000-0000-4000-8000-000000000002', event: 'Inflation release', type: 'Inflation', date: '2026-08-20', sensitivity: 'Medium', status: 'Scheduled', source: 'Synthetic source', cluster: 'macro-demo', linkedTickers: ['SAMPLE'], revision: 1, data: {} },
  ],
  positions: [],
  journal: [],
  opportunities: [{ id: '40000000-0000-4000-8000-000000000001', catalystId: '20000000-0000-4000-8000-000000000001', ideaId: '10000000-0000-4000-8000-000000000001', ticker: 'DEMO', exposure: 'index', sensitivity: 'High', rationale: 'Synthetic mapping for layout review.', scores: { clarity: 4 } }],
  pendingReviews: 0,
  lastLoadedAt: '2026-08-08T12:00:00Z',
};
