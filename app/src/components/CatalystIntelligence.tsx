import { useMemo, useState, type ReactNode } from 'react';
import { Calculator, CloudDownload, Database, Save } from 'lucide-react';
import { calibrationStats, dataQuality, ivContext, midpoint, straddleImpliedMove, volatilityImpliedMove } from '../lib/catalyst-intelligence/analytics';
import { manualOptionsSnapshot, defaultProviderStatuses } from '../lib/catalyst-intelligence/providers';
import { earlyEntryAssessment, evaluateScenarios } from '../lib/catalyst-intelligence/scenarios';
import { sessionDefinitions } from '../lib/catalyst-intelligence/timeline';
import type { MarketSnapshot, ProviderStatus, ScenarioInput, TradingSessionLabel, VerticalStrategy } from '../lib/catalyst-intelligence/types';
import { spreadMetrics } from '../lib/payoff';
import type { Catalyst, SnapshotType, SourceQuality, TradeIdea, Workspace } from '../types/domain';
import { OptionChainSnapshot } from './OptionChainSnapshot';

const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const today = () => localDateTime().slice(0, 10);
const number = (value: string) => value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
const percent = (value: string) => { const parsed = number(value); return parsed === undefined ? undefined : parsed / 100; };
const valueNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const formatMoney = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
const strategyOf = (idea: TradeIdea): VerticalStrategy | undefined => {
  const value = idea.strategy.toLowerCase().replaceAll(' ', '-');
  if (value === 'bull-call-spread') return value;
  if (value === 'bear-put-spread') return value;
  return undefined;
};

export type CatalystIntelligenceSnapshotInput = {
  catalystId?: string;
  tradeIdeaId?: string;
  snapshotType: SnapshotType;
  ticker?: string;
  observedAt: string;
  methodology: string;
  values: Record<string, unknown>;
  provider?: string;
  sourceQuality?: SourceQuality;
  freshness?: 'current' | 'delayed' | 'historical' | 'manual';
  fetchedAt?: string;
  sourceReference?: string;
  sessionLabel?: TradingSessionLabel;
  sourceDate?: string;
  calendarDaysToCatalyst?: number;
  catalystTimezone?: string;
  catalystSession?: string;
};

export type CatalystIntelligenceActions = {
  saveSnapshot: (input: CatalystIntelligenceSnapshotInput) => Promise<unknown>;
  loadProviderStatus: () => Promise<ProviderStatus[]>;
  loadDelayedOptions: (input: { ticker: string; expiration: string; strikeLimit: number }) => Promise<{ snapshots: MarketSnapshot[]; cache?: { hit: boolean; fetchedAt: string } }>;
};

export type CatalystIntelligencePresentation = {
  badge?: ReactNode;
  initialManual?: Partial<{
    observedAt: string; ticker: string; underlying: string; expiration: string; longStrike: string; shortStrike: string;
    longBid: string; longAsk: string; shortBid: string; shortAsk: string; longIv: string; shortIv: string; volume: string; openInterest: string;
    callBid: string; callAsk: string; putBid: string; putAsk: string; atmIv: string; dte: string; source: string; methodology: string; notes: string; sessionLabel: TradingSessionLabel | '';
  }>;
  initialOptions?: MarketSnapshot[];
  initialRiskFreeRate?: string;
  providerActionsEnabled?: boolean;
  reviewAction?: { label: string; onReview: (scenarioPrice?: number) => void | Promise<void> };
  snapshotPersistence?: {
    saved: boolean;
    saveLabel?: string;
    savedLabel?: string;
    manualSuccessMessage?: string;
    providerSuccessMessage?: string;
    savedNotice?: string;
  };
};

export function CatalystIntelligence({ catalyst, workspace, actions, onSaved, setMessage, presentation }: { catalyst: Catalyst; workspace: Workspace; actions: CatalystIntelligenceActions; onSaved: () => void | Promise<void>; setMessage: (message: string) => void; presentation?: CatalystIntelligencePresentation }) {
  const relatedIdeas = useMemo(() => workspace.ideas.filter((idea) => idea.catalystId === catalyst.id || workspace.ideaCatalystLinks.some((link) => link.catalystId === catalyst.id && link.tradeIdeaId === idea.id)), [catalyst.id, workspace.ideaCatalystLinks, workspace.ideas]);
  const candidateOptions = useMemo(() => relatedIdeas.flatMap((idea) => idea.candidates.map((candidate) => ({ key: `${idea.id}:${candidate.id}`, idea, candidate, strategy: strategyOf(idea) }))).filter((item) => item.strategy), [relatedIdeas]);
  const [selectedKey, setSelectedKey] = useState(candidateOptions[0]?.key || '');
  const selected = candidateOptions.find((item) => item.key === selectedKey) || candidateOptions[0];
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>(defaultProviderStatuses);
  const [fetched, setFetched] = useState<{ snapshots: MarketSnapshot[]; cache?: { hit: boolean; fetchedAt: string } }>({ snapshots: presentation?.initialOptions || [] });
  const [manual, setManual] = useState({
    observedAt: localDateTime(), ticker: selected?.idea.ticker || catalyst.linkedTickers[0] || '', underlying: '', expiration: '',
    longStrike: selected?.candidate.longStrike === undefined ? '' : String(selected.candidate.longStrike), shortStrike: selected?.candidate.shortStrike === undefined ? '' : String(selected.candidate.shortStrike),
    longBid: '', longAsk: '', shortBid: '', shortAsk: '', longIv: '', shortIv: '', volume: '', openInterest: '',
    callBid: '', callAsk: '', putBid: '', putAsk: '', atmIv: '', dte: '', source: '', methodology: 'Manual market snapshot transcribed from the named source.', notes: '', sessionLabel: '' as TradingSessionLabel | '',
    ...presentation?.initialManual,
  });
  const [riskFreeRate, setRiskFreeRate] = useState(presentation?.initialRiskFreeRate || '');
  const [strikeLimit, setStrikeLimit] = useState('6');
  const scenarioDate = catalyst.date && catalyst.date >= today() ? catalyst.date : today();
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    { id: 'bull', label: 'Bull', probability: 25, movePercent: 2, targetIv: 0.2, evaluationDate: scenarioDate },
    { id: 'base', label: 'Base', probability: 50, movePercent: 0, targetIv: 0.2, evaluationDate: scenarioDate },
    { id: 'bear', label: 'Bear', probability: 25, movePercent: -2, targetIv: 0.2, evaluationDate: scenarioDate },
  ]);
  const [scenarioResult, setScenarioResult] = useState<ReturnType<typeof evaluateScenarios>>();
  const snapshotPersistence = presentation?.snapshotPersistence;

  const callMid = midpoint(number(manual.callBid), number(manual.callAsk));
  const putMid = midpoint(number(manual.putBid), number(manual.putAsk));
  const straddleMove = callMid !== undefined && putMid !== undefined && number(manual.underlying) !== undefined ? straddleImpliedMove(callMid, putMid, number(manual.underlying)!) : undefined;
  const volatilityMove = percent(manual.atmIv) !== undefined && number(manual.dte) !== undefined && number(manual.underlying) !== undefined ? volatilityImpliedMove(number(manual.underlying)!, percent(manual.atmIv)!, number(manual.dte)!) : undefined;
  const candidateEconomics = selected?.strategy && selected.candidate.longStrike !== undefined && selected.candidate.shortStrike !== undefined && selected.candidate.debit !== undefined
    ? spreadMetrics(selected.strategy, selected.candidate.longStrike, selected.candidate.shortStrike, selected.candidate.debit, selected.candidate.contracts || 1) : undefined;

  // Workspace loading centralizes lifecycle filtering, so every analytical view receives active observations only.
  const snapshots = workspace.researchSnapshots.filter((item) => item.catalystId === catalyst.id);
  const currentIv = percent(manual.atmIv);
  const ivHistory = snapshots.map((item) => valueNumber(item.values.implied_volatility)).filter((item): item is number => item !== undefined).map((item) => item > 1 ? item / 100 : item);
  const ivStats = currentIv === undefined ? undefined : ivContext(currentIv, ivHistory);
  const calibrationRows = snapshots.flatMap((item) => {
    const impliedMove = valueNumber(item.values.event_implied_move_percent);
    const realizedMove = valueNumber(item.values.realized_move_percent);
    const preEventDrift = valueNumber(item.values.pre_event_drift_percent);
    return impliedMove === undefined || realizedMove === undefined ? [] : [{ impliedMove, realizedMove, preEventDrift }];
  });
  const calibration = calibrationStats(calibrationRows);
  const quality = dataQuality({ sourceQuality: catalyst.sourceQuality, freshness: snapshots[0]?.freshness || 'manual', sampleCount: calibration?.count || 0, requiredFieldsPresent: calibration ? 2 : snapshots.length ? 1 : 0, requiredFieldCount: 2 });

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    try { await action(); if (success) setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Catalyst Intelligence update failed.'); }
    finally { setBusy(false); }
  };

  const saveManual = async () => {
    const underlyingPrice = number(manual.underlying);
    if (!manual.ticker.trim() || underlyingPrice === undefined || underlyingPrice <= 0 || !manual.observedAt || !manual.methodology.trim()) throw new Error('Add a ticker, underlying price, observation time, and methodology.');
    const side = selected?.strategy === 'bear-put-spread' ? 'put' : 'call';
    const common = { ticker: manual.ticker.trim().toUpperCase(), underlyingPrice, expiration: manual.expiration || undefined, sourceReference: manual.source || undefined, observedAt: new Date(manual.observedAt).toISOString(), methodology: manual.methodology };
    const longLeg = number(manual.longStrike) === undefined ? undefined : manualOptionsSnapshot({ ...common, optionSide: side, strike: number(manual.longStrike), bid: number(manual.longBid), ask: number(manual.longAsk), impliedVolatility: percent(manual.longIv), volume: number(manual.volume), openInterest: number(manual.openInterest) });
    const shortLeg = number(manual.shortStrike) === undefined ? undefined : manualOptionsSnapshot({ ...common, optionSide: side, strike: number(manual.shortStrike), bid: number(manual.shortBid), ask: number(manual.shortAsk), impliedVolatility: percent(manual.shortIv) });
    const eventDate = catalyst.date ? new Date(`${catalyst.date}T12:00:00Z`) : undefined;
    const observed = new Date(manual.observedAt);
    await actions.saveSnapshot({ catalystId: catalyst.id, tradeIdeaId: selected?.idea.id, ticker: manual.ticker, snapshotType: 'market_pricing', observedAt: manual.observedAt, methodology: manual.methodology, provider: 'manual', sourceQuality: manual.source ? 'primary' : 'unverified', freshness: 'manual', fetchedAt: new Date().toISOString(), sourceReference: manual.source, sessionLabel: manual.sessionLabel || undefined, sourceDate: manual.observedAt.slice(0, 10), calendarDaysToCatalyst: eventDate ? Math.round((eventDate.getTime() - observed.getTime()) / 86_400_000) : undefined, catalystTimezone: catalyst.timezoneName, catalystSession: catalyst.marketSession, values: { market_snapshot_version: '1.0', underlying_price: underlyingPrice, expiration: manual.expiration, strategy: selected?.strategy, long_leg: longLeg, short_leg: shortLeg, atm_call_midpoint: callMid, atm_put_midpoint: putMid, event_implied_move_percent: straddleMove?.percentMove, expiration_implied_move_percent: volatilityMove?.percentMove, notes: manual.notes } });
    await onSaved();
  };

  const fetchProviders = () => run(async () => setProviders(await actions.loadProviderStatus()), 'Provider availability refreshed. No market-data credits were used.');
  const fetchOptions = () => run(async () => setFetched(await actions.loadDelayedOptions({ ticker: manual.ticker, expiration: manual.expiration, strikeLimit: Number(strikeLimit) })), 'Delayed option data loaded by explicit request.');
  const saveFetched = () => run(async () => {
    const first = fetched.snapshots[0];
    if (!first) throw new Error('There is no provider snapshot to save.');
    await actions.saveSnapshot({ catalystId: catalyst.id, tradeIdeaId: selected?.idea.id, ticker: first.ticker, snapshotType: 'market_pricing', observedAt: first.observedAt, methodology: first.methodology, provider: first.provider, sourceQuality: first.sourceQuality, freshness: first.freshness, fetchedAt: first.fetchedAt, sourceReference: first.sourceReference, sourceDate: first.observedAt.slice(0, 10), catalystTimezone: catalyst.timezoneName, catalystSession: catalyst.marketSession, values: { market_snapshot_version: '1.0', option_chain: fetched.snapshots } });
    await onSaved();
  }, snapshotPersistence?.providerSuccessMessage || 'Provider snapshot appended to the private Research Ledger.');

  const calculateScenarios = () => {
    if (!selected?.strategy || !candidateEconomics || selected.candidate.longStrike === undefined || selected.candidate.shortStrike === undefined || selected.candidate.debit === undefined || number(manual.underlying) === undefined || !manual.expiration || percent(riskFreeRate) === undefined) {
      setMessage('Select a complete vertical Candidate, then add spot, expiration, and risk-free rate.'); return;
    }
    const result = evaluateScenarios(number(manual.underlying)!, scenarios, { strategy: selected.strategy, longStrike: selected.candidate.longStrike, shortStrike: selected.candidate.shortStrike, debit: selected.candidate.debit, contracts: selected.candidate.contracts || 1, riskFreeRate: percent(riskFreeRate)!, dividendYield: 0, style: 'american' }, new Date(manual.observedAt), new Date(`${manual.expiration}T20:00:00`));
    if (!result) { setMessage('Scenario probabilities must total 100%, dates must fall between the observation and expiration, and all values must be valid.'); return; }
    setScenarioResult(result); setMessage('Scenario values calculated. Nothing in the linked Idea was changed.');
  };
  const assessment = scenarioResult && candidateEconomics ? earlyEntryAssessment(scenarioResult.expectedValue, candidateEconomics.maxLoss) : earlyEntryAssessment(NaN, NaN);

  return <section className="intelligence-layer" aria-labelledby="intelligence-title" data-shared-ui="catalyst-intelligence">
    <header className="section-heading"><div><span className="eyebrow">Private analytical layer</span><h2 id="intelligence-title">Catalyst Intelligence</h2><p>Data collection, transparent calculations, and your interpretation remain separate. No trade or Idea is changed automatically.</p></div>{presentation?.badge || <span className="status">Zero recurring cost</span>}</header>

    <div className="intelligence-summary">
      <article className="card metric-card"><span>Straddle estimate</span><strong>{straddleMove ? `${straddleMove.percentMove.toFixed(2)}%` : 'Insufficient'}</strong><small>{straddleMove ? `${formatMoney(straddleMove.dollarMove)} from ATM call + put midpoints` : 'Add valid ATM call and put bid/ask.'}</small></article>
      <article className="card metric-card"><span>Volatility estimate</span><strong>{volatilityMove ? `${volatilityMove.percentMove.toFixed(2)}%` : 'Insufficient'}</strong><small>{volatilityMove ? `${formatMoney(volatilityMove.dollarMove)} one-sigma estimate` : 'Add annualized IV and DTE.'}</small></article>
      <article className="card metric-card"><span>IV context</span><strong>{ivStats?.rank === undefined ? 'Insufficient' : `${ivStats.rank.toFixed(0)} rank`}</strong><small>{ivStats ? `${ivStats.percentile.toFixed(0)} percentile · n = ${ivStats.count}` : 'Add current IV and at least two saved IV observations.'}</small></article>
      <article className="card metric-card"><span>Calibration</span><strong>n = {calibration?.count || 0}</strong><small>{quality} data quality · descriptive only</small></article>
      <article className="card metric-card"><span>Early-entry assessment</span><strong>{assessment.label}</strong><small>{assessment.rationale}</small></article>
    </div>

    <details className="card intelligence-panel" open><summary><span><Database size={17} />Market Pricing &amp; Manual Snapshot</span><small>Permanent no-key path</small></summary>
      <div className="form-grid intelligence-form">
        <label><span>Observed at</span><input type="datetime-local" value={manual.observedAt} onChange={(event) => setManual({ ...manual, observedAt: event.target.value })} /></label>
        <label><span>Ticker</span><input value={manual.ticker} onChange={(event) => setManual({ ...manual, ticker: event.target.value.toUpperCase() })} /></label>
        <label><span>Underlying price</span><input inputMode="decimal" value={manual.underlying} onChange={(event) => setManual({ ...manual, underlying: event.target.value })} /></label>
        <label><span>Expiration</span><input type="date" value={manual.expiration} onChange={(event) => setManual({ ...manual, expiration: event.target.value })} /></label>
        <label><span>Timeline anchor</span><select value={manual.sessionLabel} onChange={(event) => setManual({ ...manual, sessionLabel: event.target.value as TradingSessionLabel | '' })}><option value="">Arbitrary snapshot</option>{Object.keys(sessionDefinitions).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Source / platform</span><input placeholder="Manual source" value={manual.source} onChange={(event) => setManual({ ...manual, source: event.target.value })} /></label>
        <label><span>Long strike</span><input inputMode="decimal" value={manual.longStrike} onChange={(event) => setManual({ ...manual, longStrike: event.target.value })} /></label>
        <label><span>Short strike</span><input inputMode="decimal" value={manual.shortStrike} onChange={(event) => setManual({ ...manual, shortStrike: event.target.value })} /></label>
        <label><span>Long bid / ask</span><span className="paired-input"><input aria-label="Long bid" inputMode="decimal" value={manual.longBid} onChange={(event) => setManual({ ...manual, longBid: event.target.value })} /><input aria-label="Long ask" inputMode="decimal" value={manual.longAsk} onChange={(event) => setManual({ ...manual, longAsk: event.target.value })} /></span></label>
        <label><span>Short bid / ask</span><span className="paired-input"><input aria-label="Short bid" inputMode="decimal" value={manual.shortBid} onChange={(event) => setManual({ ...manual, shortBid: event.target.value })} /><input aria-label="Short ask" inputMode="decimal" value={manual.shortAsk} onChange={(event) => setManual({ ...manual, shortAsk: event.target.value })} /></span></label>
        <label><span>Long / short IV (%)</span><span className="paired-input"><input aria-label="Long IV percent" inputMode="decimal" value={manual.longIv} onChange={(event) => setManual({ ...manual, longIv: event.target.value })} /><input aria-label="Short IV percent" inputMode="decimal" value={manual.shortIv} onChange={(event) => setManual({ ...manual, shortIv: event.target.value })} /></span></label>
        <label><span>Volume / open interest</span><span className="paired-input"><input aria-label="Volume" inputMode="numeric" value={manual.volume} onChange={(event) => setManual({ ...manual, volume: event.target.value })} /><input aria-label="Open interest" inputMode="numeric" value={manual.openInterest} onChange={(event) => setManual({ ...manual, openInterest: event.target.value })} /></span></label>
        <label><span>ATM call bid / ask</span><span className="paired-input"><input aria-label="ATM call bid" inputMode="decimal" value={manual.callBid} onChange={(event) => setManual({ ...manual, callBid: event.target.value })} /><input aria-label="ATM call ask" inputMode="decimal" value={manual.callAsk} onChange={(event) => setManual({ ...manual, callAsk: event.target.value })} /></span></label>
        <label><span>ATM put bid / ask</span><span className="paired-input"><input aria-label="ATM put bid" inputMode="decimal" value={manual.putBid} onChange={(event) => setManual({ ...manual, putBid: event.target.value })} /><input aria-label="ATM put ask" inputMode="decimal" value={manual.putAsk} onChange={(event) => setManual({ ...manual, putAsk: event.target.value })} /></span></label>
        <label><span>ATM IV (%)</span><input inputMode="decimal" value={manual.atmIv} onChange={(event) => setManual({ ...manual, atmIv: event.target.value })} /></label>
        <label><span>Days to expiration</span><input inputMode="numeric" value={manual.dte} onChange={(event) => setManual({ ...manual, dte: event.target.value })} /></label>
        <label className="wide"><span>Methodology</span><textarea value={manual.methodology} onChange={(event) => setManual({ ...manual, methodology: event.target.value })} /></label>
        <label className="wide"><span>Notes</span><textarea value={manual.notes} onChange={(event) => setManual({ ...manual, notes: event.target.value })} /></label>
      </div>
      <div className="panel-actions"><button className="primary" disabled={busy || snapshotPersistence?.saved} onClick={() => void run(saveManual, snapshotPersistence?.manualSuccessMessage || 'Manual market snapshot appended to the private Research Ledger.')}><Save size={16} />{snapshotPersistence?.saved ? snapshotPersistence.savedLabel || 'Snapshot Saved' : snapshotPersistence?.saveLabel || 'Save Snapshot'}</button>{presentation?.reviewAction && <button disabled={busy} onClick={() => void run(async () => presentation.reviewAction!.onReview(number(manual.underlying)), 'Synthetic Intelligence reviewed. No provider request was made.')}>{presentation.reviewAction.label}</button>}</div>
      {snapshotPersistence?.saved && snapshotPersistence.savedNotice && <p className="method-note" role="status">{snapshotPersistence.savedNotice}</p>}
    </details>

    <details className="card intelligence-panel" open><summary><span><Calculator size={17} />Candidate Economics &amp; Scenario Lab</span><small>User-controlled assumptions</small></summary>
      {candidateOptions.length ? <>
        <div className="scenario-toolbar"><label><span>Linked Candidate</span><select value={selected?.key || ''} onChange={(event) => setSelectedKey(event.target.value)}>{candidateOptions.map((item) => <option key={item.key} value={item.key}>{item.idea.ticker} · {item.candidate.legacyName || item.candidate.name}</option>)}</select></label><label><span>Risk-free rate (%)</span><input inputMode="decimal" placeholder="Manual or Treasury" value={riskFreeRate} onChange={(event) => setRiskFreeRate(event.target.value)} /></label></div>
        {candidateEconomics ? <dl className="economics-grid"><div><dt>Debit</dt><dd>{formatMoney(selected!.candidate.debit!)}</dd></div><div><dt>Width</dt><dd>{formatMoney(candidateEconomics.width)}</dd></div><div><dt>Max loss</dt><dd>{formatMoney(candidateEconomics.maxLoss)}</dd></div><div><dt>Max profit</dt><dd>{formatMoney(candidateEconomics.maxProfit)}</dd></div><div><dt>Break-even</dt><dd>{candidateEconomics.breakEven.toFixed(2)}</dd></div><div><dt>Reward / risk</dt><dd>{candidateEconomics.rewardToRisk?.toFixed(2) || 'TBD'}</dd></div></dl> : <p className="muted-copy">This Candidate needs valid strikes, debit, and contracts before economics can be calculated.</p>}
        <div className="scenario-grid">{scenarios.map((scenario, index) => <article key={scenario.id}><h3>{scenario.label}</h3><label><span>Probability (%)</span><input type="number" min="0" max="100" value={scenario.probability} onChange={(event) => setScenarios(scenarios.map((item, itemIndex) => itemIndex === index ? { ...item, probability: Number(event.target.value) } : item))} /></label><label><span>Underlying move (%)</span><input inputMode="decimal" value={scenario.movePercent ?? ''} onChange={(event) => setScenarios(scenarios.map((item, itemIndex) => itemIndex === index ? { ...item, movePercent: Number(event.target.value), targetPrice: undefined } : item))} /></label><label><span>Target IV (%)</span><input inputMode="decimal" value={scenario.targetIv * 100} onChange={(event) => setScenarios(scenarios.map((item, itemIndex) => itemIndex === index ? { ...item, targetIv: Number(event.target.value) / 100 } : item))} /></label><label><span>Evaluation date</span><input type="date" value={scenario.evaluationDate} onChange={(event) => setScenarios(scenarios.map((item, itemIndex) => itemIndex === index ? { ...item, evaluationDate: event.target.value } : item))} /></label>{scenarioResult?.results[index] && <div className="scenario-output"><b>{formatMoney(scenarioResult.results[index].theoreticalValue)} theoretical mark</b><span>{formatMoney(scenarioResult.results[index].profitLoss)} P/L · {scenarioResult.results[index].returnOnRisk?.toFixed(1) || 'TBD'}% risk return</span></div>}</article>)}</div>
        <div className="panel-actions"><button className="primary" onClick={calculateScenarios}><Calculator size={16} />Calculate Scenario EV</button>{scenarioResult && <span><b>Expected value: {formatMoney(scenarioResult.expectedValue)}</b> · {assessment.label}</span>}</div>
        <p className="method-note">Pre-expiration values use a 200-step CRR theoretical model for American-style options, a zero dividend yield unless supplied in a future version, and your rate/IV assumptions. Theoretical marks are not executable prices. Assessment bands are visible: Attractive ≥ 10% of max risk; Expensive &lt; -5%; otherwise Fairly Priced.</p>
      </> : <p className="muted-copy">Link a complete bull-call or bear-put Candidate to this catalyst. Intelligence never selects or changes strikes.</p>}
    </details>

    <details className="card intelligence-panel" open><summary><span>Timeline &amp; Calibration</span><small>Append-only learning record</small></summary>
      <div className="timeline-anchors">{Object.entries(sessionDefinitions).map(([anchor, definition]) => { const items = snapshots.filter((item) => item.sessionLabel === anchor); return <div key={anchor}><b>{anchor}</b><span>{items.length ? `${items.length} snapshot${items.length === 1 ? '' : 's'}` : 'Open'}</span><small>{definition}</small></div>; })}</div>
      <div className="calibration-grid intelligence-calibration"><div><span>Sample</span><strong>n = {calibration?.count || 0}</strong></div><div><span>Avg implied move</span><strong>{calibration ? `${calibration.averageImpliedMove.toFixed(2)}%` : 'Insufficient'}</strong></div><div><span>Avg realized move</span><strong>{calibration ? `${calibration.averageRealizedMove.toFixed(2)}%` : 'Insufficient'}</strong></div><div><span>Avg absolute error</span><strong>{calibration ? `${calibration.averageAbsoluteError.toFixed(2)}%` : 'Insufficient'}</strong></div></div>
      <p className="method-note">Calibration is descriptive, always shows n, and only uses snapshots that contain both implied and realized move fields. A small sample is not a confidence interval or win probability.</p>
      {snapshots.length > 0 && <div className="intelligence-history">{snapshots.slice(0, 12).map((item) => <article key={item.id}><b>{item.sessionLabel || 'Arbitrary'} · {item.snapshotType.replaceAll('_', ' ')}</b><span>{new Date(item.observedAt).toLocaleString()} · {item.provider} · {item.freshness}</span><small>{item.methodology}</small></article>)}</div>}
    </details>

    <details className="card intelligence-panel"><summary><span><CloudDownload size={17} />Providers &amp; Methodology</span><small>Explicit refresh only</small></summary>
      <div className="provider-grid">{providers.map((provider) => <article key={provider.id}><span className={`quality-dot ${provider.availability}`} /> <b>{provider.label}</b><small>{provider.availability.replaceAll('_', ' ')} · {provider.freshness}</small><p>{provider.detail}</p></article>)}</div>
      {fetched.snapshots.length > 0 && <div className="provider-chain-preview"><OptionChainSnapshot contracts={fetched.snapshots} cache={fetched.cache} /></div>}
      <div className="panel-actions"><button disabled={busy || presentation?.providerActionsEnabled === false} onClick={() => void fetchProviders()}><CloudDownload size={16} />Check Provider Status</button><label className="inline-control"><span>Nearby strikes</span><input type="number" min="1" max="10" value={strikeLimit} onChange={(event) => setStrikeLimit(event.target.value)} /></label><button disabled={busy || presentation?.providerActionsEnabled === false || !manual.ticker || !manual.expiration} onClick={() => void fetchOptions()}>Load Delayed Options</button>{fetched.snapshots.length > 0 && <button className="primary" disabled={busy || snapshotPersistence?.saved} onClick={() => void saveFetched()}>{snapshotPersistence?.saved ? snapshotPersistence.savedLabel || 'Snapshot Saved' : `Save ${fetched.snapshots.length} Contracts`}</button>}</div>
      <p className="method-note">No polling. MarketData requests require one ticker, one exact expiration, and at most 10 nearby strikes. BLS and Treasury use public official endpoints. SEC requires a request identity; FRED, BEA, Census, and MarketData use optional server secrets. Missing credentials never disable manual entry.</p>
    </details>
  </section>;
}
