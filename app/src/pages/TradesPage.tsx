import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardCheck, Plus, XCircle } from 'lucide-react';
import { EmptyCard, ExpandablePanel, MetricCard, SummaryCard } from '../components/cards';
import { recordEntry, recordTradeExit, saveTradeCheckin } from '../data/actions';
import type { Position, Workspace } from '../types/domain';
import { PageHeader } from '../components/layout/AppShell';
import { exposureSummary, openRiskSummary } from '../lib/trade-lifecycle';
import { tradeCardFacts } from '../lib/card-presentation';
import { navigate, navigateToCatalyst } from '../config/navigation';
import { RecordTradeEditor, TradeCheckinEditor, TradeDetailSurface, TradeExitEditor } from '../components/editors/TradeLifecycleEditors';

const money = (value?: number) => value === undefined ? 'TBD' : `$${value.toFixed(2)}`;

function TradeDetails({ position, workspace, onSaved, onDebrief }: { position: Position; workspace: Workspace; onSaved: () => void | Promise<void>; onDebrief: (position: Position) => void }) {
  const [form, setForm] = useState<'checkin' | 'exit' | null>(null);
  return <ExpandablePanel title={`${position.ticker} Trade Detail`} summary="Entry context, monitoring, research, and history.">
    <div className="trade-detail-actions"><button onClick={() => setForm(form === 'checkin' ? null : 'checkin')}><ClipboardCheck size={15} />Add Check-In</button>{position.status === 'active' ? <button className="primary" onClick={() => setForm(form === 'exit' ? null : 'exit')}><XCircle size={15} />Record Exit</button> : <button onClick={() => onDebrief(position)}><BookOpen size={15} />Open Debrief</button>}</div>
    {form === 'checkin' && <TradeCheckinEditor position={position} onCancel={() => setForm(null)} onSave={async (input) => { await saveTradeCheckin(input); await onSaved(); setForm(null); }} />}
    {form === 'exit' && <TradeExitEditor position={position} onCancel={() => setForm(null)} onSave={async (input) => { await recordTradeExit(input); await onSaved(); setForm(null); onDebrief(position); }} />}
    <TradeDetailSurface position={position} workspace={workspace} onOpenCatalyst={navigateToCatalyst} onViewIdea={() => navigate('/ideas')} />
  </ExpandablePanel>;
}

export function TradesPage({ workspace, onSaved, initialIdeaId, onInitialIdeaConsumed, onDebrief }: { workspace: Workspace; onSaved: () => void | Promise<void>; initialIdeaId?: string; onInitialIdeaConsumed?: () => void; onDebrief: (position: Position) => void }) {
  const [tab, setTab] = useState<'active' | 'closed'>('active'); const [entry, setEntry] = useState(Boolean(initialIdeaId));
  useEffect(() => { if (initialIdeaId) setEntry(true); }, [initialIdeaId]);
  const positions = workspace.positions.filter((item) => item.status === tab);
  const risk = openRiskSummary(workspace.positions, workspace.policy?.maximumOpenRisk); const exposures = useMemo(() => exposureSummary(workspace.positions), [workspace.positions]);
  const closeEntry = () => { setEntry(false); onInitialIdeaConsumed?.(); };
  return <div className="page"><PageHeader title="Trades" subtitle="Preserve execution, monitor the thesis, and review the full decision story." action={<button className="primary" data-tour-id="record-trade-action" onClick={() => setEntry(!entry)}><Plus size={17} />Record Trade</button>} />
    <section className="metric-grid trade-risk-metrics"><MetricCard title="Open Options Max Loss" value={money(risk.used)} subtitle="Actual defined-risk loss across open Trades." /><MetricCard title="OJ Risk Ceiling" value={money(risk.ceiling)} subtitle="Your deliberate risk policy—not a brokerage limit." /><MetricCard title="Remaining Capacity" value={money(risk.remaining)} subtitle="Not brokerage buying power." /><MetricCard title="Open Trades" value={risk.openCount} subtitle="Confirmed positions only." /></section>
    {entry && <RecordTradeEditor workspace={workspace} initialIdeaId={initialIdeaId} onCancel={closeEntry} onRecord={async (input) => { await recordEntry(input); await onSaved(); closeEntry(); }} />}
    {exposures.some((item) => item.trades > 1) && <section className="card exposure-summary"><header><div><span className="eyebrow">Informational only</span><h2>Exposure Concentration</h2></div><p>Tags identify shared context without claiming precise portfolio correlation or double-counting risk.</p></header><div>{exposures.filter((item) => item.trades > 1).map((item) => <article key={item.tag}><b>{item.tag}</b><strong>{item.trades} open Trades</strong><span>{money(item.risk)} tagged max loss</span></article>)}</div></section>}
    <section data-tour-id="trade-monitoring"><div className="section-tabs" role="tablist"><button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active</button><button role="tab" aria-selected={tab === 'closed'} className={tab === 'closed' ? 'active' : ''} onClick={() => setTab('closed')}>Closed</button></div>
    {positions.length ? <div className="trade-list">{positions.map((item) => { const facts = tradeCardFacts(item, workspace); return <div className="object-stack" key={item.id}><SummaryCard title={item.ticker} subtitle={item.strategy} status={item.status} metric={item.maxRisk === undefined ? 'Risk TBD' : `${money(item.maxRisk)} max loss`} meta={`${item.contracts} contract${item.contracts === 1 ? '' : 's'} · Expires ${facts.expiration}`}><div className="summary-facts"><span><b>Thesis health</b><small>{facts.thesis}</small></span><span><b>Next catalyst</b><small>{facts.catalyst}</small></span></div></SummaryCard><TradeDetails position={item} workspace={workspace} onSaved={onSaved} onDebrief={onDebrief} /></div>; })}</div> : <EmptyCard title={tab === 'active' ? 'No Active Trades' : 'No Closed Trades'} subtitle={tab === 'active' ? 'Watchlist research stays in Ideas until you manually record an actual fill.' : 'Closed positions remain here with their entry context and history.'} />}</section>
  </div>;
}
