import { describe, expect, it } from 'vitest';
import { catalystMarkdown, journalExportFiles, tradeMarkdown } from './markdown';
import { createZip } from './zip';
import { demoWorkspace } from '../../data/demo';
import type { Position } from '../../types/domain';

describe('Markdown portability', () => {
  it('preserves research stage, exposure, and TBD fields in a trade export', () => { const markdown = tradeMarkdown(demoWorkspace.ideas[1]); expect(markdown).toContain('status: "deferred"'); expect(markdown).toContain('research_stage: "parked"'); expect(markdown).toContain('exposure_tags:'); expect(markdown).toContain('Not entered.'); expect(markdown).toContain('TBD'); });
  it('exports the Catalyst brief and linked securities', () => { const markdown = catalystMarkdown(demoWorkspace.catalysts[0]); expect(markdown).toContain('record_type: catalyst'); expect(markdown).toContain('date_certainty: "confirmed"'); expect(markdown).toContain('## Expectations'); expect(markdown).toContain('DEMO'); });
  it('builds an Obsidian-friendly journal tree with provenance and snapshots', () => { const files = journalExportFiles(demoWorkspace); expect(Object.keys(files).some((name) => name.startsWith('Trade Ideas/'))).toBe(true); expect(Object.keys(files).some((name) => name.startsWith('Catalysts/'))).toBe(true); expect(Object.keys(files)).toContain('Dashboard.md'); expect(Object.keys(files)).toContain('Journal/Journal Index.md'); expect(Object.keys(files)).toContain('Research/Account Policy.md'); expect(files['Research/Sources.md']).toContain('Synthetic schedule source'); expect(files['Research/Snapshots.md']).toContain('event_implied_move'); });
  it('keeps archived ideas and candidates in a separate export folder', () => { const archived = { ...demoWorkspace.ideas[0], archivedAt: '2026-08-10T12:00:00Z' }; const files = journalExportFiles({ ...demoWorkspace, ideas: demoWorkspace.ideas.slice(1), archivedIdeas: [archived] }); const name = Object.keys(files).find((item) => item.startsWith('Archived Ideas/')); expect(name).toBeTruthy(); expect(files[name!]).toContain('### Candidate'); expect(files[name!]).not.toContain('### Balanced'); expect(files['Dashboard.md']).toContain('Archived ideas: 1'); });
  it('produces a valid ZIP container signature', () => { const zip = createZip({ 'README.md': '# Export' }); expect(Array.from(zip.slice(0, 4))).toEqual([0x50,0x4b,0x03,0x04]); });
  it('exports the full planned-versus-actual lifecycle and user-authored debrief', () => {
    const position: Position = {
      id: 'export-trade', ideaId: demoWorkspace.ideas[0].id, ticker: 'DEMO', strategy: 'Bear Put Spread', status: 'closed', contracts: 1, maxRisk: 75, maxProfit: 225, breakEven: 99.25,
      expiration: '2026-09-18', longStrike: 100, shortStrike: 97, actualDebit: 0.75, entryFees: 0.5, exposureTags: ['macro-demo'], openedAt: '2026-08-13T14:00:00Z', closedAt: '2026-08-14T14:00:00Z', revision: 2, data: {},
      entryContext: { version: 1, capturedAt: '2026-08-13T14:00:00Z', ideaId: demoWorkspace.ideas[0].id, ideaRevision: 2, thesis: 'Preserved entry thesis.', evidence: 'Entry evidence.', entryConditions: 'Entry condition.', invalidation: 'Entry invalidation.', plannedExit: 'Entry exit plan.', holdThroughEvents: [], avoidEvents: [], candidate: { id: 'candidate', revision: 1, plannedDebit: 0.8, plannedMaxLoss: 80 }, linkedCatalysts: [], researchSnapshotIds: ['snapshot'], forecastIds: ['forecast'], exposureTags: [] },
      checkins: [{ id: 'checkin', tradeId: 'export-trade', ideaId: demoWorkspace.ideas[0].id, thesisHealth: 'weaker', checkedAt: '2026-08-13T18:00:00Z', whatChanged: 'Pricing changed.', priceChanged: true, catalystChanged: false, volatilityChanged: true, macroChanged: false, plannedExitState: 'reassess', invalidationOccurred: false, managementView: 'Reassess.', data: {} }],
      exit: { id: 'exit', tradeId: 'export-trade', ideaId: demoWorkspace.ideas[0].id, exitedAt: '2026-08-14T14:00:00Z', contractsExited: 1, exitValue: 1.2, exitValueType: 'credit', fees: 0.5, realizedPnl: 44, exitReason: 'target_reached', thesisHealth: 'intact', data: {} },
    };
    const review = { id: 'review', ideaId: position.ideaId, tradeId: position.id, kind: 'review' as const, createdAt: '2026-08-14T15:00:00Z', summary: 'Synthetic debrief.', data: { 'What was right': 'Process.', 'What was wrong': 'Timing.', Repeat: 'Research.', 'Avoid next time': 'Chasing.', 'Catalyst outcome': 'Synthetic result.', Lesson: 'Stay deliberate.' } };
    const files = journalExportFiles({ ...demoWorkspace, positions: [position], journal: [review] });
    const trade = Object.entries(files).find(([name]) => name.startsWith('Closed Trades/'))?.[1] || '';
    const journal = Object.entries(files).find(([name]) => name.startsWith('Journal/2026-08-14'))?.[1] || '';
    expect(trade).toContain('Preserved entry thesis.');
    expect(trade).toContain('Planned debit: 0.8');
    expect(trade).toContain('Actual debit: 0.75');
    expect(trade).toContain('Research snapshots: snapshot');
    expect(trade).toContain('Reason: target_reached');
    expect(journal).toContain('What was right: Process.');
    expect(journal).toContain('Stay deliberate.');
  });
});
