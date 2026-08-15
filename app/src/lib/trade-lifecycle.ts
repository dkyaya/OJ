import { spreadMetrics, type Spread, type SpreadMetrics } from './payoff';
import type { Candidate, Catalyst, ExitReason, Position, ThesisHealth, TradeClass, TradeIdea, TradeIdeaCatalystLink } from '../types/domain';

export const TRADE_CLASS_LABELS: Record<TradeClass, string> = {
  pre_catalyst_anticipation: 'Pre-Catalyst Anticipation',
  catalyst_hold: 'Catalyst Hold',
  post_catalyst_confirmation: 'Post-Catalyst Confirmation',
};

export const THESIS_HEALTH_LABELS: Record<ThesisHealth, string> = {
  stronger: 'Stronger',
  intact: 'Intact',
  weaker: 'Weaker',
  invalidated: 'Invalidated',
};

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  target_reached: 'Target Reached',
  thesis_invalidated: 'Thesis Invalidated',
  catalyst_approaching: 'Catalyst Approaching',
  risk_reduction: 'Risk Reduction',
  time_decay: 'Time Decay',
  volatility_change: 'Volatility Change',
  better_opportunity: 'Better Opportunity',
  manual_other: 'Manual / Other',
};

export type TradeEntryDraft = {
  ideaId: string;
  candidateId: string;
  tradeClass: TradeClass;
  expiration: string;
  longStrike: string;
  shortStrike: string;
  contracts: string;
  actualDebit: string;
  fees: string;
  openedAt: string;
  notes: string;
  confirmed: boolean;
  riskAcknowledged: boolean;
  riskNote: string;
};

const localTimestamp = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

export function spreadStrategy(strategy: string): Spread | null {
  const value = strategy.trim().toLowerCase().replaceAll(' ', '-');
  return value === 'bull-call-spread' || value === 'bear-put-spread' ? value : null;
}

export function tradeEntryDraft(idea?: TradeIdea, candidate?: Candidate): TradeEntryDraft {
  return {
    ideaId: idea?.id || '',
    candidateId: candidate?.id || '',
    tradeClass: 'pre_catalyst_anticipation',
    expiration: candidate?.expiration || '',
    longStrike: candidate?.longStrike?.toString() || '',
    shortStrike: candidate?.shortStrike?.toString() || '',
    contracts: candidate?.contracts?.toString() || '1',
    actualDebit: candidate?.debit?.toString() || '',
    fees: '0',
    openedAt: localTimestamp(),
    notes: '',
    confirmed: false,
    riskAcknowledged: false,
    riskNote: '',
  };
}

export function tradeEntryMetrics(idea: TradeIdea | undefined, draft: TradeEntryDraft): SpreadMetrics | null {
  const strategy = idea ? spreadStrategy(idea.strategy) : null;
  if (!strategy) return null;
  return spreadMetrics(strategy, Number(draft.longStrike), Number(draft.shortStrike), Number(draft.actualDebit), Number(draft.contracts));
}

export function validateTradeEntry(idea: TradeIdea | undefined, draft: TradeEntryDraft, maximumOpenRisk?: number, currentOpenRisk = 0) {
  const errors: string[] = [];
  if (!idea || draft.ideaId !== idea.id) errors.push('Choose an eligible Idea.');
  if (!draft.expiration) errors.push('Add the actual expiration.');
  if (!draft.openedAt || !Number.isFinite(new Date(draft.openedAt).getTime())) errors.push('Add the actual fill time.');
  if (draft.expiration && draft.openedAt && draft.expiration < draft.openedAt.slice(0, 10)) errors.push('Expiration cannot precede the actual fill date.');
  if (!Number.isInteger(Number(draft.contracts)) || Number(draft.contracts) < 1) errors.push('Contracts must be a positive whole number.');
  if (!Number.isFinite(Number(draft.fees)) || Number(draft.fees) < 0) errors.push('Fees cannot be negative.');
  const metrics = tradeEntryMetrics(idea, draft);
  if (!metrics) errors.push('Enter a valid debit vertical: correct strike order and a debit above $0 but below the spread width.');
  const projected = metrics ? currentOpenRisk + metrics.maxLoss : currentOpenRisk;
  if (maximumOpenRisk !== undefined && projected > maximumOpenRisk) {
    if (!draft.riskAcknowledged) errors.push('Please acknowledge that this confirmed historical fill exceeds the current OJ risk ceiling.');
    if (!draft.riskNote.trim()) errors.push('Explain the risk-ceiling exception.');
  }
  if (!draft.confirmed) errors.push('Confirm that this is an actual fill recorded after execution elsewhere.');
  return { errors, metrics, projectedRisk: projected };
}

export function openRiskSummary(positions: Position[], maximumOpenRisk?: number) {
  const open = positions.filter((position) => position.status === 'active');
  const used = open.reduce((sum, position) => sum + (position.maxRisk || 0), 0);
  return {
    used,
    ceiling: maximumOpenRisk,
    remaining: maximumOpenRisk === undefined ? undefined : maximumOpenRisk - used,
    openCount: open.length,
  };
}

export function exposureSummary(positions: Position[]) {
  const exposure = new Map<string, { trades: number; risk: number }>();
  positions.filter((position) => position.status === 'active').forEach((position) => {
    position.exposureTags.forEach((tag) => {
      const current = exposure.get(tag) || { trades: 0, risk: 0 };
      exposure.set(tag, { trades: current.trades + 1, risk: current.risk + (position.maxRisk || 0) });
    });
  });
  return [...exposure.entries()].map(([tag, value]) => ({ tag, ...value })).sort((a, b) => b.trades - a.trades || b.risk - a.risk || a.tag.localeCompare(b.tag));
}

export function realizedVerticalPnl(entryDebit: number, entryFees: number, exitValue: number, exitValueType: 'credit' | 'debit', exitFees: number, contracts: number) {
  if (![entryDebit, entryFees, exitValue, exitFees, contracts].every(Number.isFinite) || entryDebit <= 0 || entryFees < 0 || exitValue < 0 || exitFees < 0 || !Number.isInteger(contracts) || contracts < 1) return null;
  const signedExit = exitValueType === 'credit' ? exitValue : -exitValue;
  return (signedExit - entryDebit) * 100 * contracts - entryFees - exitFees;
}

export type RelevantCatalyst = { catalyst: Catalyst; relationship: string };

export function upcomingTradeCatalysts(position: Position, catalysts: Catalyst[], links: TradeIdeaCatalystLink[], today = new Date().toISOString().slice(0, 10)): RelevantCatalyst[] {
  const relationships = new Map<string, string>();
  position.entryContext?.linkedCatalysts.forEach((link) => relationships.set(link.catalystId, link.relationship));
  if (position.entryContext?.originatingCatalystId) relationships.set(position.entryContext.originatingCatalystId, 'originating');
  if (position.originatingCatalystId) relationships.set(position.originatingCatalystId, 'originating');
  links.filter((link) => link.tradeIdeaId === position.ideaId).forEach((link) => { if (!relationships.has(link.catalystId)) relationships.set(link.catalystId, link.relationship); });
  const hold = new Set((position.entryContext?.holdThroughEvents || []).map((item) => item.trim().toLowerCase()));
  const avoid = new Set((position.entryContext?.avoidEvents || []).map((item) => item.trim().toLowerCase()));
  return catalysts
    .filter((catalyst) => catalyst.scheduleKind === 'scheduled' && Boolean(catalyst.date && catalyst.date >= today))
    .flatMap((catalyst) => {
      const name = catalyst.event.trim().toLowerCase();
      const relationship = avoid.has(name) ? 'Avoid' : hold.has(name) ? 'Hold Through' : relationships.get(catalyst.id);
      return relationship ? [{ catalyst, relationship }] : [];
    })
    .sort((a, b) => (a.catalyst.eventAt || a.catalyst.date || '').localeCompare(b.catalyst.eventAt || b.catalyst.date || ''));
}
