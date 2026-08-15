import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { EmptyCard } from '../cards';
import type { ExitReason, Position, ThesisHealth, TradeClass, Workspace } from '../../types/domain';
import {
  EXIT_REASON_LABELS, openRiskSummary, realizedVerticalPnl, THESIS_HEALTH_LABELS, TRADE_CLASS_LABELS,
  tradeEntryDraft, upcomingTradeCatalysts, validateTradeEntry,
} from '../../lib/trade-lifecycle';
import { useEffect, useState, type ReactNode } from 'react';

const localTimestamp = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const money = (value?: number) => value === undefined ? 'TBD' : `$${value.toFixed(2)}`;
const field = (value?: string) => value?.trim() || 'TBD';

export type RecordTradeInput = {
  ideaId: string;
  candidateId?: string;
  tradeClass: TradeClass;
  expiration: string;
  longStrike: number;
  shortStrike: number;
  contracts: number;
  openedAt: string;
  actualDebit: number;
  fees: number;
  notes?: string;
  confirmed: boolean;
  riskAcknowledged: boolean;
  riskNote?: string;
};

export type TradeCheckinInput = {
  tradeId: string;
  thesisHealth: ThesisHealth;
  checkedAt: string;
  whatChanged?: string;
  priceChanged: boolean;
  catalystChanged: boolean;
  volatilityChanged: boolean;
  macroChanged: boolean;
  plannedExitState: 'still_valid' | 'reassess' | 'changed';
  invalidationOccurred: boolean;
  managementView?: string;
  notes?: string;
};

export type TradeExitInput = {
  tradeId: string;
  exitedAt: string;
  exitValue: number;
  exitValueType: 'credit' | 'debit';
  fees: number;
  exitReason: ExitReason;
  thesisHealth: ThesisHealth;
  catalystRelationship?: string;
  notes?: string;
  confirmed: boolean;
};

export function RiskCapacity({ workspace, projected }: { workspace: Workspace; projected?: number }) {
  const risk = openRiskSummary(workspace.positions, workspace.policy?.maximumOpenRisk);
  const remaining = projected === undefined || risk.ceiling === undefined ? risk.remaining : risk.ceiling - projected;
  return <section className="risk-capacity-panel" aria-label="OJ risk-policy capacity">
    <div><span>Open defined-risk options max loss</span><strong>{money(risk.used)}</strong></div>
    <div><span>OJ risk ceiling</span><strong>{money(risk.ceiling)}</strong></div>
    <div data-negative={(remaining || 0) < 0 ? 'true' : undefined}><span>{projected === undefined ? 'Remaining capacity' : 'Remaining after entry'}</span><strong>{money(remaining)}</strong></div>
    <p>Remaining capacity under your OJ open-options risk ceiling. This is not brokerage buying power.</p>
  </section>;
}

export function RecordTradeEditor({ workspace, initialIdeaId, initialActualDebit, onCancel, onRecord, title = 'Record Trade', badge }: {
  workspace: Workspace;
  initialIdeaId?: string;
  initialActualDebit?: number;
  onCancel: () => void;
  onRecord: (input: RecordTradeInput) => void | Promise<void>;
  title?: string;
  badge?: ReactNode;
}) {
  const eligible = workspace.ideas.filter((idea) => ['watchlist','ready'].includes(idea.status) && !workspace.positions.some((position) => position.ideaId === idea.id));
  const initialIdea = eligible.find((idea) => idea.id === initialIdeaId) || eligible[0];
  const initialDraft = () => ({ ...tradeEntryDraft(initialIdea, initialIdea?.candidates[0]), ...(initialActualDebit === undefined ? {} : { actualDebit: String(initialActualDebit) }) });
  const [form, setForm] = useState(initialDraft);
  const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const idea = eligible.find((item) => item.id === form.ideaId);
  const candidate = idea?.candidates.find((item) => item.id === form.candidateId);
  const originatingCatalyst = workspace.catalysts.find((item) => item.id === idea?.catalystId);
  const openRisk = openRiskSummary(workspace.positions, workspace.policy?.maximumOpenRisk).used;
  const validation = validateTradeEntry(idea, form, workspace.policy?.maximumOpenRisk, openRisk);

  useEffect(() => {
    if (!initialIdeaId) return;
    const selected = eligible.find((item) => item.id === initialIdeaId);
    if (selected) setForm({ ...tradeEntryDraft(selected, selected.candidates[0]), ...(initialActualDebit === undefined ? {} : { actualDebit: String(initialActualDebit) }) });
  }, [initialActualDebit, initialIdeaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseIdea = (ideaId: string) => {
    const selected = eligible.find((item) => item.id === ideaId);
    setForm({ ...tradeEntryDraft(selected, selected?.candidates[0]), ...(initialActualDebit === undefined ? {} : { actualDebit: String(initialActualDebit) }) }); setMessage('');
  };
  const chooseCandidate = (candidateId: string) => {
    const selected = idea?.candidates.find((item) => item.id === candidateId);
    setForm((current) => ({ ...tradeEntryDraft(idea, selected), tradeClass: current.tradeClass, openedAt: current.openedAt, notes: current.notes, ...(initialActualDebit === undefined ? {} : { actualDebit: String(initialActualDebit) }) }));
  };
  const submit = async () => {
    setMessage('');
    if (validation.errors.length) return setMessage(validation.errors.join(' '));
    if (!idea || !validation.metrics) return;
    setSaving(true);
    try {
      await onRecord({ ideaId: idea.id, candidateId: form.candidateId || undefined, tradeClass: form.tradeClass, expiration: form.expiration, longStrike: Number(form.longStrike), shortStrike: Number(form.shortStrike), contracts: Number(form.contracts), openedAt: form.openedAt, actualDebit: Number(form.actualDebit), fees: Number(form.fees), notes: form.notes, confirmed: form.confirmed, riskAcknowledged: form.riskAcknowledged, riskNote: form.riskNote });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Trade entry could not be recorded.'); }
    finally { setSaving(false); }
  };
  const projectedOver = validation.metrics && workspace.policy && validation.projectedRisk > workspace.policy.maximumOpenRisk;

  return <section className="card inline-form trade-entry-form" data-shared-ui="record-trade-editor">
    <header><div>{badge}<span className="eyebrow">Manual execution record</span><h2>{title}</h2><p>Use this only after execution occurs elsewhere. OJ cannot place or change an order.</p></div></header>
    {!eligible.length ? <EmptyCard title="No Eligible Ideas" subtitle="A Watchlist or Ready Idea without a confirmed trade is required." /> : <>
      <div className="form-grid">
        <label><span>Trade Idea</span><select value={form.ideaId} onChange={(event) => chooseIdea(event.target.value)}>{eligible.map((item) => <option key={item.id} value={item.id}>{item.ticker} · {item.strategy}</option>)}</select></label>
        <label><span>Planned Candidate</span><select value={form.candidateId} onChange={(event) => chooseCandidate(event.target.value)}><option value="">No Candidate</option>{idea?.candidates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.longStrike ?? 'TBD'} / {item.shortStrike ?? 'TBD'}</option>)}</select></label>
        <label><span>Trade Class</span><select value={form.tradeClass} onChange={(event) => setForm({ ...form, tradeClass: event.target.value as TradeClass })}>{Object.entries(TRADE_CLASS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Actual Expiration</span><input type="date" value={form.expiration} onChange={(event) => setForm({ ...form, expiration: event.target.value })} /></label>
        <label><span>Actual Long Strike</span><input inputMode="decimal" value={form.longStrike} onChange={(event) => setForm({ ...form, longStrike: event.target.value })} /></label>
        <label><span>Actual Short Strike</span><input inputMode="decimal" value={form.shortStrike} onChange={(event) => setForm({ ...form, shortStrike: event.target.value })} /></label>
        <label><span>Contracts</span><input inputMode="numeric" value={form.contracts} onChange={(event) => setForm({ ...form, contracts: event.target.value })} /></label>
        <label><span>Actual Debit</span><small>Your executed spread fill.</small><input inputMode="decimal" value={form.actualDebit} onChange={(event) => setForm({ ...form, actualDebit: event.target.value })} /></label>
        <label><span>Entry Fees</span><input inputMode="decimal" value={form.fees} onChange={(event) => setForm({ ...form, fees: event.target.value })} /></label>
        <label><span>Filled At</span><input type="datetime-local" value={form.openedAt} onChange={(event) => setForm({ ...form, openedAt: event.target.value })} /></label>
        <label className="wide"><span>Entry Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      {idea && <section className="entry-source-summary" aria-label="Prepopulated research context"><div><span>Ticker</span><strong>{idea.ticker}</strong></div><div><span>Setup</span><strong>{idea.assetType || 'Security'} · {idea.strategy} · {idea.bias}</strong></div><div><span>Originating Catalyst</span><strong>{originatingCatalyst?.event || 'None linked'}</strong></div><div><span>Research Provenance</span><strong>Idea r{idea.revision} · {candidate ? `Candidate r${candidate.revision}` : 'No Candidate'}</strong></div><p>{idea.thesis || 'No thesis recorded.'}</p></section>}
      <div className="planned-actual-grid">
        <section><span className="eyebrow">Planned Candidate</span><dl><div><dt>Debit</dt><dd>{money(candidate?.debit)}</dd></div><div><dt>Strikes</dt><dd>{candidate ? `${candidate.longStrike ?? 'TBD'} / ${candidate.shortStrike ?? 'TBD'}` : 'TBD'}</dd></div><div><dt>Contracts</dt><dd>{candidate?.contracts ?? 'TBD'}</dd></div><div><dt>Max loss</dt><dd>{money(candidate?.maxLoss)}</dd></div></dl></section>
        <section><span className="eyebrow">Actual Trade</span>{validation.metrics ? <dl><div><dt>Width</dt><dd>${validation.metrics.width.toFixed(2)}</dd></div><div><dt>Max loss</dt><dd>{money(validation.metrics.maxLoss)}</dd></div><div><dt>Max profit</dt><dd>{money(validation.metrics.maxProfit)}</dd></div><div><dt>Break-even</dt><dd>{validation.metrics.breakEven.toFixed(2)}</dd></div><div><dt>Reward / risk</dt><dd>{validation.metrics.rewardToRisk?.toFixed(2) ?? 'N/A'}</dd></div></dl> : <p>Complete the actual vertical structure to calculate its economics.</p>}</section>
      </div>
      <RiskCapacity workspace={workspace} projected={validation.metrics ? validation.projectedRisk : undefined} />
      {projectedOver && <section className="risk-acknowledgement"><p>This historical fill brings open defined-risk loss above the current OJ ceiling. OJ records it but does not resize or reject the trade.</p><label className="confirm-row"><input type="checkbox" checked={form.riskAcknowledged} onChange={(event) => setForm({ ...form, riskAcknowledged: event.target.checked })} /><span>I acknowledge the OJ policy exception.</span></label><label><span>Reason</span><textarea value={form.riskNote} onChange={(event) => setForm({ ...form, riskNote: event.target.value })} /></label></section>}
      <label className="confirm-row"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /><span>I confirm this is an actual fill executed outside OJ.</span></label>
      {message && <p className="page-message" role="alert">{message}</p>}
      <footer><button onClick={onCancel}>Cancel</button><button className="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Recording' : 'Record Trade'}</button></footer>
    </>}
  </section>;
}

export function TradeCheckinEditor({ position, onCancel, onSave, initialWhatChanged = '' }: { position: Position; onCancel: () => void; onSave: (input: TradeCheckinInput) => void | Promise<void>; initialWhatChanged?: string }) {
  const [form, setForm] = useState({ thesisHealth: 'intact' as ThesisHealth, checkedAt: localTimestamp(), whatChanged: initialWhatChanged, priceChanged: false, catalystChanged: false, volatilityChanged: false, macroChanged: false, plannedExitState: 'still_valid' as 'still_valid' | 'reassess' | 'changed', invalidationOccurred: false, managementView: '', notes: '' });
  const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await onSave({ tradeId: position.id, ...form }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Check-in failed.'); } finally { setSaving(false); } };
  return <section className="inline-form nested-trade-form" data-shared-ui="trade-checkin-editor"><header><h3>Trade Check-In</h3><p>Record a concise observation. This does not change or close the Trade.</p></header><div className="form-grid"><label><span>Thesis Health</span><select value={form.thesisHealth} onChange={(event) => setForm({ ...form, thesisHealth: event.target.value as ThesisHealth })}>{Object.entries(THESIS_HEALTH_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Checked At</span><input type="datetime-local" value={form.checkedAt} onChange={(event) => setForm({ ...form, checkedAt: event.target.value })} /></label><label><span>Planned Exit</span><select value={form.plannedExitState} onChange={(event) => setForm({ ...form, plannedExitState: event.target.value as typeof form.plannedExitState })}><option value="still_valid">Still Valid</option><option value="reassess">Reassess</option><option value="changed">Management View Changed</option></select></label><label className="wide"><span>What Changed?</span><textarea value={form.whatChanged} onChange={(event) => setForm({ ...form, whatChanged: event.target.value })} /></label><label className="wide"><span>Current Management View</span><textarea placeholder="Optional update; the original plan remains unchanged." value={form.managementView} onChange={(event) => setForm({ ...form, managementView: event.target.value })} /></label></div><div className="checkin-signals"><label><input type="checkbox" checked={form.priceChanged} onChange={(event) => setForm({ ...form, priceChanged: event.target.checked })} />Price structure</label><label><input type="checkbox" checked={form.catalystChanged} onChange={(event) => setForm({ ...form, catalystChanged: event.target.checked })} />Catalyst information</label><label><input type="checkbox" checked={form.volatilityChanged} onChange={(event) => setForm({ ...form, volatilityChanged: event.target.checked })} />IV / pricing</label><label><input type="checkbox" checked={form.macroChanged} onChange={(event) => setForm({ ...form, macroChanged: event.target.checked })} />Macro context</label><label><input type="checkbox" checked={form.invalidationOccurred} onChange={(event) => setForm({ ...form, invalidationOccurred: event.target.checked })} />Invalidation occurred</label></div>{message && <p className="page-message">{message}</p>}<footer><button onClick={onCancel}>Cancel</button><button className="primary" disabled={saving || !form.whatChanged.trim()} onClick={() => void save()}>{saving ? 'Saving' : 'Save Check-In'}</button></footer></section>;
}

export function TradeExitEditor({ position, onCancel, onSave, initialExitValue = '', initialExitReason = 'manual_other' }: { position: Position; onCancel: () => void; onSave: (input: TradeExitInput) => void | Promise<void>; initialExitValue?: string | number; initialExitReason?: ExitReason }) {
  const [form, setForm] = useState({ exitedAt: localTimestamp(), exitValue: String(initialExitValue), exitValueType: 'credit' as 'credit' | 'debit', fees: '0', exitReason: initialExitReason, thesisHealth: 'intact' as ThesisHealth, catalystRelationship: '', notes: '', confirmed: false });
  const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const pnl = realizedVerticalPnl(position.actualDebit || 0, position.entryFees, Number(form.exitValue), form.exitValueType, Number(form.fees), position.contracts);
  const save = async () => { if (!form.confirmed || pnl === null) return setMessage('Complete and confirm the actual closing transaction.'); setSaving(true); try { await onSave({ tradeId: position.id, exitedAt: form.exitedAt, exitValue: Number(form.exitValue), exitValueType: form.exitValueType, fees: Number(form.fees), exitReason: form.exitReason, thesisHealth: form.thesisHealth, catalystRelationship: form.catalystRelationship, notes: form.notes, confirmed: form.confirmed }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Exit failed.'); } finally { setSaving(false); } };
  return <section className="inline-form nested-trade-form" data-shared-ui="trade-exit-editor"><header><h3>Record Full Exit</h3><p>Phase 8.6 records one complete closing transaction; it does not provide multi-lot accounting.</p></header><div className="form-grid"><label><span>Exited At</span><input type="datetime-local" value={form.exitedAt} onChange={(event) => setForm({ ...form, exitedAt: event.target.value })} /></label><label><span>Closing Transaction</span><select value={form.exitValueType} onChange={(event) => setForm({ ...form, exitValueType: event.target.value as 'credit' | 'debit' })}><option value="credit">Credit Received</option><option value="debit">Debit Paid</option></select></label><label><span>Closing Value</span><input inputMode="decimal" value={form.exitValue} onChange={(event) => setForm({ ...form, exitValue: event.target.value })} /></label><label><span>Exit Fees</span><input inputMode="decimal" value={form.fees} onChange={(event) => setForm({ ...form, fees: event.target.value })} /></label><label><span>Exit Reason</span><select value={form.exitReason} onChange={(event) => setForm({ ...form, exitReason: event.target.value as ExitReason })}>{Object.entries(EXIT_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Thesis at Exit</span><select value={form.thesisHealth} onChange={(event) => setForm({ ...form, thesisHealth: event.target.value as ThesisHealth })}>{Object.entries(THESIS_HEALTH_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="wide"><span>Catalyst Relationship</span><input value={form.catalystRelationship} onChange={(event) => setForm({ ...form, catalystRelationship: event.target.value })} /></label><label className="wide"><span>Exit Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="exit-preview"><span>Estimated realized P/L</span><strong>{pnl === null ? 'Complete actual values' : `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`}</strong></div><label className="confirm-row"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /><span>I confirm this is the actual full closing transaction.</span></label>{message && <p className="page-message">{message}</p>}<footer><button onClick={onCancel}>Cancel</button><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Recording' : 'Record Exit & Debrief'}</button></footer></section>;
}

export function TradeDetailSurface({ position, workspace, onOpenCatalyst, onViewIdea }: { position: Position; workspace: Workspace; onOpenCatalyst?: (id: string) => void; onViewIdea?: () => void }) {
  const context = position.entryContext; const idea = [...workspace.ideas, ...workspace.archivedIdeas].find((item) => item.id === position.ideaId);
  const events = upcomingTradeCatalysts(position, workspace.catalysts, workspace.ideaCatalystLinks);
  const snapshots = workspace.researchSnapshots.filter((item) => context?.researchSnapshotIds.includes(item.id));
  const forecasts = workspace.forecasts.filter((item) => context?.forecastIds.includes(item.id));
  const latest = position.checkins[0];
  return <div data-shared-ui="trade-detail-surface">
    <div className="trade-detail-grid">
      <section><span className="eyebrow">Trade Structure</span><h3>{position.strategy}</h3><dl><div><dt>Expiration</dt><dd>{position.expiration || 'TBD'}</dd></div><div><dt>Strikes</dt><dd>{position.longStrike ?? 'TBD'} / {position.shortStrike ?? 'TBD'}</dd></div><div><dt>Contracts</dt><dd>{position.contracts}</dd></div><div><dt>Actual debit</dt><dd>{money(position.actualDebit)}</dd></div><div><dt>Max loss</dt><dd>{money(position.maxRisk)}</dd></div><div><dt>Max profit</dt><dd>{money(position.maxProfit)}</dd></div><div><dt>Break-even</dt><dd>{position.breakEven?.toFixed(2) || 'TBD'}</dd></div></dl></section>
      <section><span className="eyebrow">Entry Thesis</span><h3>{position.tradeClass ? TRADE_CLASS_LABELS[position.tradeClass] : 'Entry Context'}</h3><p>{field(context?.thesis)}</p><dl><div><dt>Invalidation</dt><dd>{field(context?.invalidation)}</dd></div><div><dt>Planned exit</dt><dd>{field(context?.plannedExit)}</dd></div><div><dt>Hold through</dt><dd>{context?.holdThroughEvents.join(', ') || 'None recorded'}</dd></div><div><dt>Avoid</dt><dd>{context?.avoidEvents.join(', ') || 'None recorded'}</dd></div></dl></section>
      <section><span className="eyebrow">Current Monitoring</span><h3>{latest ? THESIS_HEALTH_LABELS[latest.thesisHealth] : 'No Check-In Yet'}</h3><p>{latest?.whatChanged || 'Add a concise observation when the thesis or management view changes.'}</p>{latest?.managementView && <small>Current management view: {latest.managementView}</small>}</section>
    </div>
    <div className="planned-actual-grid"><section><span className="eyebrow">Planned Candidate at Entry</span><dl><div><dt>Debit</dt><dd>{money(context?.candidate?.plannedDebit)}</dd></div><div><dt>Strikes</dt><dd>{context?.candidate ? `${context.candidate.longStrike ?? 'TBD'} / ${context.candidate.shortStrike ?? 'TBD'}` : 'TBD'}</dd></div><div><dt>Idea revision</dt><dd>{context?.ideaRevision ?? 'Legacy entry'}</dd></div><div><dt>Candidate revision</dt><dd>{context?.candidate?.revision ?? 'TBD'}</dd></div></dl></section><section><span className="eyebrow">Actual Execution</span><dl><div><dt>Debit</dt><dd>{money(position.actualDebit)}</dd></div><div><dt>Strikes</dt><dd>{position.longStrike ?? 'TBD'} / {position.shortStrike ?? 'TBD'}</dd></div><div><dt>Filled</dt><dd>{new Date(position.openedAt).toLocaleString()}</dd></div><div><dt>Fees</dt><dd>{money(position.entryFees)}</dd></div></dl></section></div>
    <div className="trade-continuity-grid">
      <section><header><div><span className="eyebrow">Upcoming Relevant Events</span><h3>Catalyst Monitoring</h3></div></header>{events.length ? events.map(({ catalyst, relationship }) => <button className="linked-context-row" key={catalyst.id} onClick={() => onOpenCatalyst?.(catalyst.id)}><span><b>{catalyst.event}</b><small>{catalyst.date} · {relationship}</small></span><ArrowRight size={15} /></button>) : <p>No linked upcoming events.</p>}</section>
      <section><header><div><span className="eyebrow">Entry Research Context</span><h3>Preserved References</h3></div></header>{snapshots.map((snapshot) => <div className="linked-context-row" key={snapshot.id}><span><b>{snapshot.snapshotType.replaceAll('_', ' ')}</b><small>{new Date(snapshot.observedAt).toLocaleString()} · {snapshot.provider}</small></span></div>)}{forecasts.map((forecast) => <div className="linked-context-row" key={forecast.id}><span><b>Locked Forecast</b><small>{forecast.expectedResult} · {forecast.lockedAt ? new Date(forecast.lockedAt).toLocaleString() : 'Entry reference'}</small></span></div>)}{!snapshots.length && !forecasts.length && <p>No pre-entry Research Ledger or Forecast reference was captured.</p>}{onViewIdea && <button className="text-button" onClick={onViewIdea}>View current linked Idea <ArrowRight size={14} /></button>}{idea && context?.thesis !== idea.thesis && <small className="history-note">The current Idea has evolved. This Trade still shows the original entry thesis above.</small>}</section>
    </div>
    <section className="trade-history"><span className="eyebrow">History</span>{position.checkins.length ? position.checkins.map((checkin) => <article key={checkin.id}><CheckCircle2 size={15} /><div><b>{THESIS_HEALTH_LABELS[checkin.thesisHealth]}</b><span>{checkin.whatChanged || 'Check-in recorded.'}</span><small>{new Date(checkin.checkedAt).toLocaleString()}</small></div></article>) : <p>No check-ins recorded.</p>}{position.exit && <article><XCircle size={15} /><div><b>{EXIT_REASON_LABELS[position.exit.exitReason]}</b><span>Realized P/L: {position.exit.realizedPnl >= 0 ? '+' : '-'}${Math.abs(position.exit.realizedPnl).toFixed(2)}</span><small>{new Date(position.exit.exitedAt).toLocaleString()}</small></div></article>}</section>
  </div>;
}
