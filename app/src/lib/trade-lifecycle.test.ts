import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import type { Position } from '../types/domain';
import { exposureSummary, openRiskSummary, realizedVerticalPnl, tradeEntryDraft, tradeEntryMetrics, upcomingTradeCatalysts, validateTradeEntry } from './trade-lifecycle';

const idea = demoWorkspace.ideas[0];
const candidate = idea.candidates[0];
const position = (overrides: Partial<Position> = {}): Position => ({
  id: crypto.randomUUID(), ideaId: idea.id, ticker: idea.ticker, strategy: idea.strategy, status: 'active', contracts: 1, maxRisk: 100,
  entryFees: 0, exposureTags: ['synthetic-tech'], checkins: [], openedAt: '2026-08-13T14:00:00Z', revision: 1, data: {}, ...overrides,
});

describe('research-to-trade prepopulation and immutable context', () => {
  it('prepopulates the selected Candidate without changing it', () => {
    const draft = tradeEntryDraft(idea, candidate);
    expect(draft).toMatchObject({ ideaId: idea.id, candidateId: candidate.id, expiration: candidate.expiration, longStrike: '100', shortStrike: '97', actualDebit: '0.8' });
    expect(candidate.debit).toBe(0.8);
  });

  it('calculates an actual improved fill independently from the planned Candidate', () => {
    const draft = { ...tradeEntryDraft(idea, candidate), actualDebit: '0.75' };
    expect(tradeEntryMetrics(idea, draft)?.maxLoss).toBe(75);
    expect(candidate.maxLoss).toBe(80);
  });

  it('calculates an actual worse fill independently from the planned Candidate', () => {
    const draft = { ...tradeEntryDraft(idea, candidate), actualDebit: '0.9' };
    expect(tradeEntryMetrics(idea, draft)?.maxLoss).toBe(90);
    expect(candidate.debit).toBe(0.8);
  });

  it('retains copied entry thesis when the current Idea evolves', () => {
    const entryThesis = idea.thesis;
    const edited = { ...idea, thesis: 'Later synthetic revision.' };
    expect(entryThesis).not.toBe(edited.thesis);
  });
});

describe('actual structure validation', () => {
  const confirmed = () => ({ ...tradeEntryDraft(idea, candidate), confirmed: true });

  it('accepts a valid bear put vertical', () => expect(validateTradeEntry(idea, confirmed(), 800, 0).errors).toEqual([]));
  it('rejects reversed bear put strikes', () => expect(validateTradeEntry(idea, { ...confirmed(), longStrike: '97', shortStrike: '100' }, 800, 0).errors.join(' ')).toContain('valid debit vertical'));
  it('rejects a debit equal to width', () => expect(validateTradeEntry(idea, { ...confirmed(), actualDebit: '3' }, 800, 0).errors.join(' ')).toContain('valid debit vertical'));
  it('rejects zero debit', () => expect(validateTradeEntry(idea, { ...confirmed(), actualDebit: '0' }, 800, 0).errors.join(' ')).toContain('valid debit vertical'));
  it('rejects expiration before the confirmed fill', () => expect(validateTradeEntry(idea, { ...confirmed(), expiration: '2026-08-12', openedAt: '2026-08-13T10:00' }, 800, 0).errors.join(' ')).toContain('Expiration cannot precede'));
  it('requires fill confirmation', () => expect(validateTradeEntry(idea, tradeEntryDraft(idea, candidate), 800, 0).errors.join(' ')).toContain('actual fill'));
  it('allows an acknowledged historical policy overshoot', () => {
    const draft = { ...confirmed(), riskAcknowledged: true, riskNote: 'Synthetic historical exception.' };
    expect(validateTradeEntry(idea, draft, 100, 50).errors).toEqual([]);
  });
  it('requires an explicit explanation for policy overshoot', () => expect(validateTradeEntry(idea, confirmed(), 100, 50).errors.join(' ')).toContain('acknowledge'));
});

describe('risk, exposure, catalyst, and exit calculations', () => {
  it('reports zero open risk with no Trades', () => expect(openRiskSummary([], 800)).toMatchObject({ used: 0, remaining: 800 }));
  it('sums multiple open Trades and excludes closed Trades', () => expect(openRiskSummary([position({ maxRisk: 150 }), position({ maxRisk: 398 }), position({ status: 'closed', maxRisk: 90 })], 800)).toMatchObject({ used: 548, remaining: 252, openCount: 2 }));
  it('reports exact ceiling without calling it buying power', () => expect(openRiskSummary([position({ maxRisk: 800 })], 800).remaining).toBe(0));
  it('shows shared exposure without changing total risk', () => {
    const trades = [position({ maxRisk: 100 }), position({ maxRisk: 200 })];
    expect(exposureSummary(trades)[0]).toMatchObject({ tag: 'synthetic-tech', trades: 2, risk: 300 });
    expect(openRiskSummary(trades, 800).used).toBe(300);
  });
  it('calculates a full vertical exit including fees', () => expect(realizedVerticalPnl(1, 1, 1.5, 'credit', 1, 2)).toBe(98));
  it('does not let an invalidated label close a Trade automatically', () => expect(position({ checkins: [{ id: 'c', tradeId: 't', ideaId: idea.id, thesisHealth: 'invalidated', checkedAt: '2026-08-13T15:00:00Z', priceChanged: false, catalystChanged: true, volatilityChanged: false, macroChanged: false, plannedExitState: 'reassess', invalidationOccurred: true, data: {} }] }).status).toBe('active'));
  it('surfaces a linked upcoming Catalyst', () => {
    const events = upcomingTradeCatalysts(position({ originatingCatalystId: demoWorkspace.catalysts[0].id }), demoWorkspace.catalysts, demoWorkspace.ideaCatalystLinks, '2026-08-13');
    expect(events[0]).toMatchObject({ relationship: 'originating' });
  });
});
