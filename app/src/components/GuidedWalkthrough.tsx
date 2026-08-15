import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FlaskConical, Pause, RefreshCcw, X } from 'lucide-react';
import { analyzeOptionChain } from '../lib/catalyst-intelligence/option-chain';
import { evaluateScenarios } from '../lib/catalyst-intelligence/scenarios';
import { volatilityImpliedMove } from '../lib/catalyst-intelligence/analytics';
import { OptionChainSnapshot } from './OptionChainSnapshot';
import { hasTourArrowModifier, isEditableTourKeyTarget } from '../features/tour/keyboard';
import { guidedTutorialSteps, type GuidedTutorialState } from '../features/tour/guided-tutorial';
import { tutorialStory } from '../features/tour/tutorial-fixtures';
import {
  addTutorialCheckin,
  clearTutorialWorkspace,
  createTutorialCatalyst,
  recordTutorialExit,
  recordTutorialTrade,
  reconstructTutorialWorkspace,
  reviewTutorialIntelligence,
  saveTutorialCandidate,
  saveTutorialDebrief,
  saveTutorialIdea,
  tutorialStageComplete,
  type TutorialWorkspace,
} from '../features/tour/tutorial-workspace';

const money = (value?: number) => value === undefined ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
const percent = (value?: number) => value === undefined ? '—' : `${value.toFixed(2)}%`;

function TutorialBadge({ detail = 'Synthetic example' }: { detail?: string }) {
  return <span className="tutorial-badge"><FlaskConical size={13} />Tutorial <small>{detail}</small></span>;
}

function CatalystStage({ workspace, onCreate }: { workspace: TutorialWorkspace; onCreate: (input: { event: string; ticker: string; date: string; time: string; category: string }) => void }) {
  const [form, setForm] = useState({ event: tutorialStory.event, ticker: tutorialStory.ticker, date: workspace.fixture.catalystDate, time: '16:05', category: 'Earnings' });
  return <section className="guided-stage-card" data-guided-action="catalyst">
    <header><div><TutorialBadge /><h2>Create the Tutorial Catalyst</h2><p>A Catalyst records what is scheduled to happen. It is the factual anchor—not your thesis.</p></div></header>
    <div className="form-grid">
      <label className="wide"><span>Event</span><input value={form.event} onChange={(event) => setForm({ ...form, event: event.target.value })} /></label>
      <label><span>Ticker mapping</span><input value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })} /></label>
      <label><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Earnings</option><option>Employment</option><option>Inflation</option></select></label>
      <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
      <label><span>Time</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
      <label><span>Visibility concept</span><select value="private" disabled><option value="private">Private tutorial session</option></select></label>
    </div>
    {workspace.catalyst ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Catalyst created</b><span>{workspace.catalyst.event} · {workspace.catalyst.ticker}</span></div></div> : <footer><button className="primary" disabled={!form.event.trim() || !form.ticker.trim() || !form.date} onClick={() => onCreate(form)}>Create Tutorial Catalyst</button></footer>}
  </section>;
}

function IntelligenceStage({ workspace, onReview }: { workspace: TutorialWorkspace; onReview: (scenarioPrice: number) => void }) {
  const [scenarioPrice, setScenarioPrice] = useState(workspace.scenarioPrice);
  const chain = analyzeOptionChain(workspace.fixture.options);
  const volatilityMove = volatilityImpliedMove(100, 0.24, 21);
  const scenario = useMemo(() => evaluateScenarios(100, [{ id: 'base', label: 'Base', probability: 100, targetPrice: scenarioPrice, targetIv: 0.24, evaluationDate: workspace.fixture.catalystDate }], {
    strategy: 'bull-call-spread', longStrike: 100, shortStrike: 105, debit: 1.4, contracts: 1, riskFreeRate: 0.04, dividendYield: 0, style: 'american',
  }, new Date(workspace.fixture.observedAt), new Date(`${workspace.fixture.expiration}T20:00:00Z`)), [scenarioPrice, workspace.fixture]);
  return <section className="guided-stage-card" data-guided-action="intelligence">
    <header><div><TutorialBadge detail="No provider request made" /><h2>Open Catalyst Intelligence</h2><p>The expected move describes priced uncertainty around the event. It is not a directional forecast.</p></div></header>
    <div className="tutorial-provenance"><div><span>Source</span><b>Tutorial Fixture</b></div><div><span>Freshness</span><b>Synthetic</b></div><div><span>Observed</span><b>Tutorial session</b></div><div><span>Provider traffic</span><b>None</b></div></div>
    <div className="intelligence-summary tutorial-intelligence-summary"><article className="card metric-card"><span>Underlying</span><strong>$100.00</strong><small>OJ Tutorial Co.</small></article><article className="card metric-card"><span>Straddle estimate</span><strong>{percent(chain?.atmSummary?.percentMove)}</strong><small>ATM call + put midpoint</small></article><article className="card metric-card"><span>Volatility estimate</span><strong>{percent(volatilityMove?.percentMove)}</strong><small>24% IV · 21 days</small></article><article className="card metric-card"><span>ATM IV</span><strong>24.0%</strong><small>Nearest 100 strike</small></article></div>
    <OptionChainSnapshot contracts={workspace.fixture.options} />
    <section className="tutorial-scenario-lab"><header><div><span className="eyebrow">Scenario Lab</span><h3>Change one assumption</h3></div><p>If the stock and volatility look like this later, what might the spread be worth?</p></header><label><span>Base scenario price</span><input aria-label="Tutorial scenario price" inputMode="decimal" value={scenarioPrice} onChange={(event) => setScenarioPrice(Number(event.target.value))} /></label><div><span>Illustrative theoretical mark</span><strong>{money(scenario?.results[0]?.theoreticalValue)}</strong><small>Model output, not an executable quote or recommendation.</small></div></section>
    <section className="tutorial-ledger-preview"><span className="eyebrow">Research Ledger</span><h3>What did I observe, when, and from what source?</h3><div><b>Market pricing · {tutorialStory.ticker}</b><span>Tutorial Fixture · Synthetic · {new Date(workspace.fixture.observedAt).toLocaleString()}</span></div></section>
    {workspace.intelligenceReviewed ? <div className="tutorial-object-created"><Check size={17} /><div><b>Intelligence reviewed</b><span>No snapshot entered the production Research Ledger.</span></div></div> : <footer><button className="primary" onClick={() => onReview(scenarioPrice)}>Mark Intelligence Reviewed</button></footer>}
  </section>;
}

function IdeaStage({ workspace, onSave }: { workspace: TutorialWorkspace; onSave: (input: { ticker: string; strategy: string; bias: string; thesis: string; evidence: string; entryConditions: string; invalidation: string; plannedExit: string }) => void }) {
  const [section, setSection] = useState<'setup' | 'catalyst' | 'research'>('setup');
  const [form, setForm] = useState({ ticker: tutorialStory.ticker, strategy: tutorialStory.strategy, bias: tutorialStory.bias, thesis: tutorialStory.thesis, evidence: tutorialStory.evidence, entryConditions: tutorialStory.entryConditions, invalidation: tutorialStory.invalidation, plannedExit: tutorialStory.plannedExit });
  return <section className="guided-stage-card" data-guided-action="idea">
    <header><div><TutorialBadge /><h2>Build the Tutorial Idea</h2><p>Catalyst = fact. Idea thesis = your interpretation. Candidate = your planned expression.</p></div></header>
    <nav className="step-nav tutorial-idea-nav" aria-label="Tutorial Idea sections">{(['setup', 'catalyst', 'research'] as const).map((item, index) => <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}><span>{index + 1}</span>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
    {section === 'setup' && <div className="form-grid"><label><span>Ticker</span><input value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })} /></label><label><span>Strategy</span><select value={form.strategy} onChange={(event) => setForm({ ...form, strategy: event.target.value })}><option>Bull Call Spread</option></select></label><label><span>Bias</span><select value={form.bias} onChange={(event) => setForm({ ...form, bias: event.target.value })}><option>Bullish</option><option>Neutral</option></select></label><label><span>Status</span><select value="Watchlist" disabled><option>Watchlist</option></select></label></div>}
    {section === 'catalyst' && <div className="tutorial-link-card"><span className="eyebrow">Originating Catalyst</span><h3>{workspace.catalyst?.event}</h3><p>Shared facts can support separate private conclusions. This walkthrough stays personal and synthetic.</p></div>}
    {section === 'research' && <div className="form-grid"><label className="wide"><span>Thesis</span><textarea value={form.thesis} onChange={(event) => setForm({ ...form, thesis: event.target.value })} /></label><label className="wide"><span>Evidence</span><textarea value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></label><label className="wide"><span>Entry conditions</span><textarea value={form.entryConditions} onChange={(event) => setForm({ ...form, entryConditions: event.target.value })} /></label><label><span>Invalidation</span><textarea value={form.invalidation} onChange={(event) => setForm({ ...form, invalidation: event.target.value })} /></label><label><span>Planned exit</span><textarea value={form.plannedExit} onChange={(event) => setForm({ ...form, plannedExit: event.target.value })} /></label><label><span>Hold-through / avoid</span><input value="Review after event · avoid late expiry" readOnly /></label></div>}
    {workspace.idea ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Idea saved</b><span>{workspace.idea.ticker} · {workspace.idea.strategy} · private interpretation</span></div></div> : <footer>{section !== 'research' ? <button className="primary" onClick={() => setSection(section === 'setup' ? 'catalyst' : 'research')}>Continue to {section === 'setup' ? 'Catalyst' : 'Research'} <ArrowRight size={15} /></button> : <button className="primary" disabled={!form.thesis.trim() || !form.invalidation.trim()} onClick={() => onSave(form)}>Save Tutorial Idea</button>}</footer>}
  </section>;
}

function CandidateStage({ workspace, onSave }: { workspace: TutorialWorkspace; onSave: (input: { longStrike: number; shortStrike: number; debit: number; contracts: number }) => void }) {
  const [form, setForm] = useState({ longStrike: tutorialStory.longStrike, shortStrike: tutorialStory.shortStrike, debit: tutorialStory.plannedDebit, contracts: tutorialStory.contracts });
  const preview = useMemo(() => {
    try { return saveTutorialCandidate({ ...workspace, candidate: undefined }, form).candidate?.metrics; } catch { return undefined; }
  }, [form, workspace]);
  return <section className="guided-stage-card" data-guided-action="candidate"><header><div><TutorialBadge /><h2>Save the Candidate</h2><p>A Candidate is the plan. It is not an order and it has not been executed.</p></div></header><div className="form-grid"><label><span>Long call strike</span><input inputMode="decimal" value={form.longStrike} onChange={(event) => setForm({ ...form, longStrike: Number(event.target.value) })} /></label><label><span>Short call strike</span><input inputMode="decimal" value={form.shortStrike} onChange={(event) => setForm({ ...form, shortStrike: Number(event.target.value) })} /></label><label><span>Planned debit</span><input inputMode="decimal" value={form.debit} onChange={(event) => setForm({ ...form, debit: Number(event.target.value) })} /></label><label><span>Contracts</span><input inputMode="numeric" value={form.contracts} onChange={(event) => setForm({ ...form, contracts: Number(event.target.value) })} /></label></div><dl className="economics-grid"><div><dt>Spread width</dt><dd>{money(preview?.width)}</dd></div><div><dt>Planned max loss</dt><dd>{money(preview?.maxLoss)}</dd></div><div><dt>Planned max profit</dt><dd>{money(preview?.maxProfit)}</dd></div><div><dt>Planned breakeven</dt><dd>{preview?.breakEven.toFixed(2) || '—'}</dd></div></dl>{workspace.candidate ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Candidate saved</b><span>100 / 105 bull call spread · $1.40 planned debit</span></div></div> : <footer><button className="primary" disabled={!preview} onClick={() => onSave(form)}>Save Candidate</button></footer>}</section>;
}

function TradeStage({ workspace, onRecord }: { workspace: TutorialWorkspace; onRecord: (actualDebit: number) => void }) {
  const [actualDebit, setActualDebit] = useState(tutorialStory.actualDebit);
  const [confirmed, setConfirmed] = useState(false);
  const preview = useMemo(() => {
    try { return recordTutorialTrade({ ...workspace, trade: undefined }, actualDebit).trade?.metrics; } catch { return undefined; }
  }, [actualDebit, workspace]);
  return <section className="guided-stage-card" data-guided-action="trade"><header><div><TutorialBadge detail="Manual record simulation" /><h2>Record the $1.32 Fill</h2><p>OJ did not place this Trade. The real flow is: research in OJ → execute with a broker → manually record the execution in OJ.</p></div></header><div className="entry-source-summary"><div><span>Ticker</span><strong>{workspace.idea?.ticker}</strong></div><div><span>Strategy</span><strong>{workspace.idea?.strategy}</strong></div><div><span>Expiration</span><strong>{workspace.candidate?.expiration}</strong></div><div><span>Strikes</span><strong>{workspace.candidate?.longStrike} / {workspace.candidate?.shortStrike}</strong></div><div><span>Catalyst</span><strong>{workspace.catalyst?.event}</strong></div><p>{workspace.idea?.thesis}</p></div><label className="tutorial-fill-input"><span>Actual debit</span><small>The executed spread fill being simulated.</small><input inputMode="decimal" value={actualDebit} onChange={(event) => setActualDebit(Number(event.target.value))} /></label><div className="planned-actual-grid"><section><span className="eyebrow">Planned Candidate</span><dl><div><dt>Debit</dt><dd>{money(workspace.candidate?.debit)}</dd></div><div><dt>Max loss</dt><dd>{money(workspace.candidate?.metrics.maxLoss)}</dd></div><div><dt>Max profit</dt><dd>{money(workspace.candidate?.metrics.maxProfit)}</dd></div><div><dt>Breakeven</dt><dd>{workspace.candidate?.metrics.breakEven.toFixed(2)}</dd></div></dl></section><section><span className="eyebrow">Actual Trade</span><dl><div><dt>Fill</dt><dd>{money(actualDebit)}</dd></div><div><dt>Max loss</dt><dd>{money(preview?.maxLoss)}</dd></div><div><dt>Max profit</dt><dd>{money(preview?.maxProfit)}</dd></div><div><dt>Breakeven</dt><dd>{preview?.breakEven.toFixed(2)}</dd></div></dl></section></div><label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I understand this simulates manual recording only; OJ placed no order.</span></label>{workspace.trade ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Trade recorded</b><span>Not included in real Trades, risk, history, or exports.</span></div></div> : <footer><button className="primary" disabled={!confirmed || !preview} onClick={() => onRecord(actualDebit)}>Record Tutorial Trade</button></footer>}</section>;
}

function MonitoringStage({ workspace, onSave }: { workspace: TutorialWorkspace; onSave: (note: string) => void }) {
  const [note, setNote] = useState(tutorialStory.checkin);
  return <section className="guided-stage-card" data-guided-action="monitoring"><header><div><TutorialBadge /><h2>Add a Trade Check-In</h2><p>Check-In = monitoring while the Trade is alive. Journal / Debrief = reflection after the outcome.</p></div></header><div className="trade-detail-grid"><section><span className="eyebrow">Entry Thesis</span><h3>{workspace.idea?.thesis}</h3><p><b>Invalidation:</b> {workspace.idea?.invalidation}</p><p><b>Planned exit:</b> {workspace.idea?.plannedExit}</p></section><section><span className="eyebrow">Actual Structure</span><h3>{workspace.candidate?.longStrike} / {workspace.candidate?.shortStrike} bull call spread</h3><p>{money(workspace.trade?.metrics.maxLoss)} max loss · {money(workspace.trade?.metrics.maxProfit)} max profit</p><p><b>Upcoming Catalyst:</b> {workspace.catalyst?.event}</p></section></div><div className="form-grid"><label><span>Thesis Health</span><select value="intact" disabled><option value="intact">Intact</option></select></label><label className="wide"><span>What changed?</span><textarea value={note} onChange={(event) => setNote(event.target.value)} /></label></div>{workspace.checkin ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Check-In saved</b><span>It remains with the Tutorial Trade and never enters the real Journal.</span></div></div> : <footer><button className="primary" disabled={!note.trim()} onClick={() => onSave(note)}>Save Check-In</button></footer>}</section>;
}

function ExitStage({ workspace, onRecord }: { workspace: TutorialWorkspace; onRecord: (value: number) => void }) {
  const [value, setValue] = useState(tutorialStory.exitValue);
  const pnl = workspace.trade && workspace.candidate ? (value - workspace.trade.actualDebit) * 100 * workspace.candidate.contracts : undefined;
  return <section className="guided-stage-card" data-guided-action="exit"><header><div><TutorialBadge /><h2>Record the Tutorial Exit</h2><p>Close the synthetic history with one full exit. Nothing enters real P/L or analytics.</p></div></header><div className="form-grid"><label><span>Closing transaction</span><select value="credit" disabled><option value="credit">Credit Received</option></select></label><label><span>Closing spread value</span><input inputMode="decimal" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label><label><span>Exit reason</span><select value="target" disabled><option value="target">Target Reached</option></select></label><label><span>Thesis at Exit</span><select value="intact" disabled><option value="intact">Intact</option></select></label></div><div className="exit-preview"><span>Tutorial realized P/L</span><strong>{pnl === undefined ? '—' : `${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}`}</strong><small>Before any fees; calculated from actual $1.32 entry and this exit value.</small></div>{workspace.exit ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Exit recorded</b><span>{money(workspace.exit.value)} spread value · +{money(workspace.exit.realizedPnl)}</span></div></div> : <footer><button className="primary" disabled={!Number.isFinite(value) || value < 0} onClick={() => onRecord(value)}>Record Tutorial Exit</button></footer>}</section>;
}

function DebriefStage({ workspace, onSave }: { workspace: TutorialWorkspace; onSave: (lesson: string) => void }) {
  const [lesson, setLesson] = useState(tutorialStory.lesson);
  return <section className="guided-stage-card" data-guided-action="debrief"><header><div><TutorialBadge /><h2>Complete the Tutorial Debrief</h2><p>Reflection adds context without rewriting the original Idea, Candidate, fill, Check-In, or Exit.</p></div></header><div className="tutorial-debrief-context"><div><span>Plan</span><b>{money(workspace.candidate?.debit)} Candidate debit</b></div><div><span>Execution</span><b>{money(workspace.trade?.actualDebit)} actual fill</b></div><div><span>Monitoring</span><b>Thesis {workspace.checkin?.thesisHealth}</b></div><div><span>Outcome</span><b>+{money(workspace.exit?.realizedPnl)}</b></div></div><label className="tutorial-lesson"><span>What was right?</span><textarea value={lesson} onChange={(event) => setLesson(event.target.value)} /></label>{workspace.debrief ? <div className="tutorial-object-created"><Check size={17} /><div><b>Tutorial Debrief saved</b><span>Visible only inside this disposable walkthrough.</span></div></div> : <footer><button className="primary" disabled={!lesson.trim()} onClick={() => onSave(lesson)}>Save Tutorial Debrief</button></footer>}</section>;
}

function InsightsStage({ workspace }: { workspace: TutorialWorkspace }) {
  return <section className="guided-stage-card" data-guided-action="insights"><header><div><TutorialBadge detail="Excluded from real analytics" /><h2>See How Real History Reaches Insights</h2><p>Real Insights become more useful as genuine history accumulates. This Tutorial Trade is never included.</p></div></header><div className="tutorial-insights-grid"><article><span>Trade class</span><b>Pre-Catalyst Anticipation</b></article><article><span>Thesis health</span><b>Intact</b></article><article><span>Planned / actual</span><b>{money(workspace.candidate?.debit)} / {money(workspace.trade?.actualDebit)}</b></article><article><span>Result</span><b>+{money(workspace.exit?.realizedPnl)}</b></article><article><span>Catalyst category</span><b>{workspace.catalyst?.category}</b></article></div><div className="tutorial-boundary-note"><b>Real OJ remains unchanged</b><span>No risk capacity, Journal, calibration, collaboration, export, or provider cache was touched.</span></div></section>;
}

export function GuidedWalkthrough({ open, state, sessionKey, onStage, onPause, onFinish, onExit, onRestart }: {
  open: boolean;
  state: GuidedTutorialState;
  sessionKey: number;
  onStage: (stage: number) => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  onExit: () => void | Promise<void>;
  onRestart: () => void | Promise<void>;
}) {
  const sessionId = useMemo(() => `session-${sessionKey}-${crypto.randomUUID()}`, [sessionKey]);
  const [workspace, setWorkspace] = useState(() => reconstructTutorialWorkspace(state.stage, sessionId));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const transitionLock = useRef(false); const heading = useRef<HTMLHeadingElement>(null);
  const step = guidedTutorialSteps[state.stage] || guidedTutorialSteps[0];
  const complete = tutorialStageComplete(workspace, state.stage);

  useEffect(() => { setWorkspace(reconstructTutorialWorkspace(state.stage, sessionId)); setMessage(''); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) window.setTimeout(() => heading.current?.focus(), 0); }, [open, state.stage]);

  const run = async (action: () => void | Promise<void>, success?: string) => {
    if (transitionLock.current) return;
    transitionLock.current = true; setBusy(true); setMessage('');
    try { await action(); if (success) setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The Tutorial action could not be completed.'); }
    finally { transitionLock.current = false; setBusy(false); }
  };
  const update = (action: (current: TutorialWorkspace) => TutorialWorkspace, success: string) => void run(() => setWorkspace(action(workspace)), success);
  const finish = () => void run(async () => { await onFinish(); setWorkspace(clearTutorialWorkspace(workspace)); });
  const exit = () => void run(async () => { await onExit(); setWorkspace(clearTutorialWorkspace(workspace)); });
  const restart = () => void run(async () => { await onRestart(); setWorkspace(clearTutorialWorkspace(workspace)); });

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void run(onPause); return; }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (hasTourArrowModifier(event) || isEditableTourKeyTarget(event.target)) return;
      if (event.key === 'ArrowLeft' && state.stage > 0) { event.preventDefault(); void run(() => onStage(state.stage - 1)); }
      if (event.key === 'ArrowRight' && complete && state.stage < guidedTutorialSteps.length - 1) { event.preventDefault(); void run(() => onStage(state.stage + 1)); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });

  if (!open) return null;
  const content = state.stage === 0 ? <CatalystStage workspace={workspace} onCreate={(input) => update((current) => createTutorialCatalyst(current, input), 'Tutorial Catalyst created. Real Catalysts are unchanged.')} />
    : state.stage === 1 ? <IntelligenceStage workspace={workspace} onReview={(scenarioPrice) => update((current) => reviewTutorialIntelligence(current, scenarioPrice), 'Synthetic Intelligence reviewed. No provider request was made.')} />
      : state.stage === 2 ? <IdeaStage workspace={workspace} onSave={(input) => update((current) => saveTutorialIdea(current, input), 'Tutorial Idea saved outside canonical Ideas.')} />
        : state.stage === 3 ? <CandidateStage workspace={workspace} onSave={(input) => update((current) => saveTutorialCandidate(current, input), 'Tutorial Candidate saved. No order exists.')} />
          : state.stage === 4 ? <TradeStage workspace={workspace} onRecord={(fill) => update((current) => recordTutorialTrade(current, fill), 'Tutorial Trade recorded without brokerage activity.')} />
            : state.stage === 5 ? <MonitoringStage workspace={workspace} onSave={(note) => update((current) => addTutorialCheckin(current, note), 'Tutorial Check-In saved outside the Journal.')} />
              : state.stage === 6 ? <ExitStage workspace={workspace} onRecord={(value) => update((current) => recordTutorialExit(current, value), 'Tutorial Exit recorded outside real P/L.')} />
                : state.stage === 7 ? <DebriefStage workspace={workspace} onSave={(lesson) => update((current) => saveTutorialDebrief(current, lesson), 'Tutorial Debrief saved in this session only.')} />
                  : <InsightsStage workspace={workspace} />;

  return <div className="page guided-walkthrough" data-session-kind="tutorial">
    <header className="guided-walkthrough-header"><div><TutorialBadge detail="Temporary workspace" /><h1 ref={heading} tabIndex={-1}>Guided Walkthrough</h1><p>Practice OJ’s core workflow with one disposable synthetic story. No real records, provider requests, or brokerage actions.</p></div><div><button disabled={busy} onClick={() => void run(onPause)}><Pause size={16} />Pause</button><button disabled={busy} onClick={restart}><RefreshCcw size={16} />Restart</button><button className="icon-button" aria-label="End Guided Walkthrough" disabled={busy} onClick={exit}><X /></button></div></header>
    <nav className="guided-progress" aria-label="Guided Walkthrough stages">{guidedTutorialSteps.map((item, index) => <button key={item.id} className={index === state.stage ? 'active' : index < state.stage ? 'complete' : ''} disabled={index > state.stage || busy} onClick={() => void run(() => onStage(index))}><span>{index < state.stage ? <Check size={12} /> : index + 1}</span><small>{item.title}</small></button>)}</nav>
    <div className="guided-stage-heading"><span className="eyebrow">{step.eyebrow}</span><strong>{state.stage + 1} / {guidedTutorialSteps.length}</strong></div>
    {message && <p className="page-message" role="status" aria-live="polite">{message}</p>}
    {content}
    <footer className="guided-walkthrough-footer"><button disabled={busy || state.stage === 0} onClick={() => void run(() => onStage(state.stage - 1))}><ArrowLeft size={15} />Back</button><span>{complete ? 'Tutorial action complete.' : 'Complete the highlighted Tutorial action to continue.'}</span>{state.stage === guidedTutorialSteps.length - 1 ? <button className="primary" disabled={busy || !complete} onClick={finish}><Check size={16} />Finish &amp; Clear Tutorial</button> : <button className="primary" disabled={busy || !complete} onClick={() => void run(() => onStage(state.stage + 1))}>Next<ArrowRight size={15} /></button>}</footer>
  </div>;
}
