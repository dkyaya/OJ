import { useEffect, useState } from 'react';
import type { Position, Workspace } from '../../types/domain';
import { EXIT_REASON_LABELS, THESIS_HEALTH_LABELS, TRADE_CLASS_LABELS } from '../../lib/trade-lifecycle';

export type DebriefInput = { ideaId: string; tradeId?: string; summary: string; lesson?: string; processRating?: number; whatWasRight?: string; whatWasWrong?: string; repeat?: string; avoid?: string; catalystOutcome?: string };

export function DebriefContext({ trade, workspace }: { trade: Position; workspace: Workspace }) {
  const context = trade.entryContext; const catalyst = workspace.catalysts.find((item) => item.id === (trade.originatingCatalystId || context?.originatingCatalystId));
  const researchReferenceCount = (context?.researchSnapshotIds.length || 0) + (context?.forecastIds.length || 0);
  return <section className="debrief-context" aria-label="Linked Trade story" data-shared-ui="debrief-context">
    <div><span className="eyebrow">Facts</span><h3>{trade.ticker} · {trade.strategy}</h3><p>{trade.expiration || 'TBD'} · {trade.longStrike ?? 'TBD'} / {trade.shortStrike ?? 'TBD'} · {trade.contracts} contract{trade.contracts === 1 ? '' : 's'}</p><small>Entry {trade.actualDebit === undefined ? 'TBD' : `$${trade.actualDebit.toFixed(2)}`} · Exit {trade.exit ? `$${trade.exit.exitValue.toFixed(2)} ${trade.exit.exitValueType}` : 'TBD'} · P/L {trade.exit ? `${trade.exit.realizedPnl >= 0 ? '+' : '-'}$${Math.abs(trade.exit.realizedPnl).toFixed(2)}` : 'TBD'}</small></div>
    <div><span className="eyebrow">Original Plan</span><h3>{trade.tradeClass ? TRADE_CLASS_LABELS[trade.tradeClass] : 'Entry Plan'}</h3><p>{context?.thesis || 'Entry thesis unavailable for this legacy Trade.'}</p><small>Candidate debit: {context?.candidate?.plannedDebit === undefined ? 'TBD' : `$${context.candidate.plannedDebit.toFixed(2)}`} · Invalidation: {context?.invalidation || 'TBD'} · Planned exit: {context?.plannedExit || 'TBD'}</small></div>
    <div><span className="eyebrow">Evolution</span><h3>{trade.checkins.length} Check-In{trade.checkins.length === 1 ? '' : 's'}</h3><p>{trade.checkins[0] ? `${THESIS_HEALTH_LABELS[trade.checkins[0].thesisHealth]} — ${trade.checkins[0].whatChanged || 'No change summary.'}` : 'No check-ins were recorded.'}</p><small>Historical check-ins remain append-only.</small></div>
    <div><span className="eyebrow">Outcome</span><h3>{trade.exit ? EXIT_REASON_LABELS[trade.exit.exitReason] : 'Open Trade'}</h3><p>{catalyst?.postEventInterpretation || catalyst?.actual || 'Catalyst outcome not yet recorded.'}</p><small>{catalyst?.event || 'No originating catalyst'}{trade.exit ? ` · Thesis ${THESIS_HEALTH_LABELS[trade.exit.thesisHealth]}` : ''} · {researchReferenceCount} entry research reference{researchReferenceCount === 1 ? '' : 's'}</small></div>
  </section>;
}

export function DebriefEditor({ workspace, initialTradeId, onCancel, onSave, initialSummary = '', initialLesson = '', initialWhatWasRight = '' }: {
  workspace: Workspace;
  initialTradeId?: string;
  onCancel: () => void;
  onSave: (input: DebriefInput) => void | Promise<void>;
  initialSummary?: string;
  initialLesson?: string;
  initialWhatWasRight?: string;
}) {
  const initialTrade = workspace.positions.find((item) => item.id === initialTradeId) || workspace.positions.find((item) => item.status === 'closed');
  const [form, setForm] = useState({ tradeId: initialTrade?.id || '', summary: initialSummary, lesson: initialLesson, processRating: '3', whatWasRight: initialWhatWasRight, whatWasWrong: '', repeat: '', avoid: '', catalystOutcome: '' });
  const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { const trade = workspace.positions.find((item) => item.id === initialTradeId); if (trade) setForm((current) => ({ ...current, tradeId: trade.id })); }, [initialTradeId, workspace.positions]);
  const trade = workspace.positions.find((item) => item.id === form.tradeId);
  const save = async () => { if (!trade) return; setSaving(true); try { await onSave({ ideaId: trade.ideaId, tradeId: trade.id, summary: form.summary, lesson: form.lesson, processRating: Number(form.processRating), whatWasRight: form.whatWasRight, whatWasWrong: form.whatWasWrong, repeat: form.repeat, avoid: form.avoid, catalystOutcome: form.catalystOutcome }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Debrief failed.'); } finally { setSaving(false); } };
  return <section className="card inline-form" data-shared-ui="debrief-editor"><header><h2>Trade Debrief</h2><p>Facts and original plans are linked automatically. Reflection remains yours to write.</p></header><div className="form-grid"><label><span>Closed Trade</span><select value={form.tradeId} onChange={(event) => setForm({ ...form, tradeId: event.target.value })}><option value="">Select a closed Trade</option>{workspace.positions.filter((item) => item.status === 'closed').map((item) => <option key={item.id} value={item.id}>{item.ticker} · {new Date(item.openedAt).toLocaleDateString()}</option>)}</select></label><label><span>Process Rating</span><select value={form.processRating} onChange={(event) => setForm({ ...form, processRating: event.target.value })}>{[1,2,3,4,5].map((rating) => <option key={rating}>{rating}</option>)}</select></label></div>
    {trade && <DebriefContext trade={trade} workspace={workspace} />}
    <div className="form-grid"><label className="wide"><span>Summary</span><textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label className="wide"><span>Catalyst Outcome</span><textarea value={form.catalystOutcome} onChange={(event) => setForm({ ...form, catalystOutcome: event.target.value })} /></label><label><span>What Was Right?</span><textarea value={form.whatWasRight} onChange={(event) => setForm({ ...form, whatWasRight: event.target.value })} /></label><label><span>What Was Wrong?</span><textarea value={form.whatWasWrong} onChange={(event) => setForm({ ...form, whatWasWrong: event.target.value })} /></label><label><span>What to Repeat</span><textarea value={form.repeat} onChange={(event) => setForm({ ...form, repeat: event.target.value })} /></label><label><span>What to Avoid</span><textarea value={form.avoid} onChange={(event) => setForm({ ...form, avoid: event.target.value })} /></label><label className="wide"><span>Lesson</span><textarea value={form.lesson} onChange={(event) => setForm({ ...form, lesson: event.target.value })} /></label></div>{message && <p className="page-message" role="alert">{message}</p>}<footer><button onClick={onCancel}>Cancel</button><button className="primary" disabled={!trade || !form.summary.trim() || saving} onClick={() => void save()}>{saving ? 'Saving' : 'Save Debrief'}</button></footer>
  </section>;
}
