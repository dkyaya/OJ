import { useMemo, useState } from 'react';
import { BookOpen, Camera, MinusCircle, Plus, RotateCcw } from 'lucide-react';
import { removeResearchSnapshot, restoreResearchSnapshot, saveResearchSnapshot, saveResearchSource } from '../data/actions';
import type { ResearchSnapshot, ResearchSnapshotRemovalReason, SnapshotType, SourceQuality, Workspace } from '../types/domain';
import { analyzeOptionChain, parseStoredOptionChain } from '../lib/catalyst-intelligence/option-chain';
import { CatalystSourceLink } from './CatalystSourceLink';
import { OptionChainSnapshot } from './OptionChainSnapshot';

const localDateTime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const scalarLabels: Record<string, string> = {
  underlying_price: 'Underlying', expiration: 'Expiration', strategy: 'Strategy', atm_call_midpoint: 'ATM call midpoint', atm_put_midpoint: 'ATM put midpoint',
  event_implied_move_percent: 'Event-implied move', expiration_implied_move_percent: 'Expiration-implied move', realized_move_percent: 'Realized move',
  pre_event_drift_percent: 'Pre-event drift', implied_volatility: 'Implied volatility', spread_debit: 'Spread debit', two_year_yield: '2Y yield', ten_year_yield: '10Y yield', fed_probability: 'Fed probability', notes: 'Notes',
};
const percentMetrics = new Set(['event_implied_move_percent', 'expiration_implied_move_percent', 'realized_move_percent', 'pre_event_drift_percent']);
const present = (value: unknown) => value !== undefined && value !== null && value !== '';
const scalarValue = (key: string, value: unknown) => percentMetrics.has(key) && Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : String(value);
const reasonOptions: Array<{ value: ResearchSnapshotRemovalReason; label: string }> = [
  { value: 'test_snapshot', label: 'Test snapshot' }, { value: 'data_entry_error', label: 'Data-entry error' }, { value: 'wrong_expiration', label: 'Wrong expiration' },
  { value: 'duplicate', label: 'Duplicate' }, { value: 'wrong_ticker', label: 'Wrong ticker' }, { value: 'bad_source_data', label: 'Bad source data' }, { value: 'other', label: 'Other' },
];

const snapshotExpiration = (item: ResearchSnapshot) => typeof item.values.expiration === 'string' ? item.values.expiration : analyzeOptionChain(parseStoredOptionChain(item.values.option_chain))?.expiration;
const snapshotMove = (item: ResearchSnapshot) => {
  const direct = Number(item.values.event_implied_move_percent);
  if (Number.isFinite(direct)) return direct;
  return analyzeOptionChain(parseStoredOptionChain(item.values.option_chain))?.atmSummary?.percentMove;
};

function SnapshotComparison({ snapshots }: { snapshots: ResearchSnapshot[] }) {
  const comparisons = useMemo(() => {
    const groups = new Map<string, ResearchSnapshot[]>();
    for (const item of snapshots) {
      const expiration = snapshotExpiration(item);
      if (!item.ticker || !expiration) continue;
      const key = `${item.ticker}:${expiration}`;
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return [...groups.entries()].flatMap(([key, items]) => {
      const manual = items.find((item) => item.provider === 'manual' || item.freshness === 'manual');
      const provider = items.find((item) => item.provider !== 'manual' && item.freshness !== 'manual');
      return manual && provider ? [{ key, manual, provider }] : [];
    });
  }, [snapshots]);
  if (!comparisons.length) return null;
  return <section className="snapshot-comparisons" aria-label="Manual and provider snapshot comparison"><h4>Manual / Provider Comparison</h4>{comparisons.map(({ key, manual, provider }) => <article key={key}>
    <header><b>{key.replace(':', ' · ')}</b><span>Same ticker and expiration</span></header>
    {[manual, provider].map((item) => <div key={item.id}><span>{item.provider}{item.sourceReference ? ` · ${item.sourceReference}` : ''} · {item.freshness}</span><strong>{snapshotMove(item) === undefined ? 'Move unavailable' : `${snapshotMove(item)!.toFixed(2)}% implied move`}</strong><small>Observed {new Date(item.observedAt).toLocaleString()}</small></div>)}
    <p>Compare provenance and timestamps before treating differences as signal.</p>
  </article>)}</section>;
}

function SnapshotCard({ item, onRemove }: { item: ResearchSnapshot; onRemove: (item: ResearchSnapshot) => void }) {
  const chain = parseStoredOptionChain(item.values.option_chain);
  const metrics = Object.entries(item.values).filter(([key, value]) => key in scalarLabels && present(value) && ['string', 'number', 'boolean'].includes(typeof value));
  return <article className="research-snapshot-card">
    <header><div><b>{item.sessionLabel ? `${item.sessionLabel} · ` : ''}{label(item.snapshotType)}</b><span>{new Date(item.observedAt).toLocaleString()} · {item.ticker || 'Cross-asset'}</span></div><span className={`freshness-badge ${item.freshness}`}>{item.freshness}</span></header>
    <div className="snapshot-provenance"><span>{item.provider}</span><span>{item.sourceQuality}</span><span>Fetched {new Date(item.fetchedAt).toLocaleString()}</span></div>
    <p>{item.methodology}</p>
    {metrics.length > 0 && <dl className="snapshot-metrics">{metrics.map(([key, value]) => <div key={key}><dt>{scalarLabels[key]}</dt><dd>{scalarValue(key, value)}</dd></div>)}</dl>}
    {chain.length > 0 ? <OptionChainSnapshot contracts={chain} technicalValues={item.values} /> : <details className="technical-details"><summary>Technical Details</summary><pre>{JSON.stringify(item.values, null, 2)}</pre></details>}
    <footer><button className="subtle-danger" onClick={() => onRemove(item)}><MinusCircle size={14} />Remove Snapshot</button></footer>
  </article>;
}

export function ResearchLedger({ workspace, catalystId, tradeIdeaId, ticker, onSaved }: {
  workspace: Workspace; catalystId?: string; tradeIdeaId?: string; ticker?: string; onSaved: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'source' | 'snapshot' | ''>('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [source, setSource] = useState({ title: '', publisher: '', url: '', sourceQuality: 'official' as SourceQuality, claimSummary: '', verified: true });
  const [snapshot, setSnapshot] = useState({ snapshotType: 'market_pricing' as SnapshotType, observedAt: localDateTime(), methodology: '', underlying: '', eventMove: '', expirationMove: '', realizedMove: '', preEventDrift: '', iv: '', debit: '', twoYear: '', tenYear: '', fedProbability: '', notes: '' });
  const [removal, setRemoval] = useState<{ item: ResearchSnapshot; reason: ResearchSnapshotRemovalReason; note: string }>();
  const sources = useMemo(() => workspace.researchSources.filter((item) => (catalystId && item.catalystId === catalystId) || (tradeIdeaId && item.tradeIdeaId === tradeIdeaId)), [catalystId, tradeIdeaId, workspace.researchSources]);
  const snapshots = useMemo(() => workspace.researchSnapshots.filter((item) => (catalystId && item.catalystId === catalystId) || (tradeIdeaId && item.tradeIdeaId === tradeIdeaId)), [catalystId, tradeIdeaId, workspace.researchSnapshots]);
  const removed = useMemo(() => workspace.removedResearchSnapshots.filter(({ snapshot: item }) => (catalystId && item.catalystId === catalystId) || (tradeIdeaId && item.tradeIdeaId === tradeIdeaId)), [catalystId, tradeIdeaId, workspace.removedResearchSnapshots]);
  const addSource = async () => { setBusy(true); setMessage(''); try { await saveResearchSource({ catalystId, tradeIdeaId, ...source }); setSource({ title: '', publisher: '', url: '', sourceQuality: 'official', claimSummary: '', verified: true }); setMode(''); await onSaved(); setMessage('Source recorded.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Source could not be saved.'); } finally { setBusy(false); } };
  const addSnapshot = async () => { setBusy(true); setMessage(''); try { await saveResearchSnapshot({ catalystId, tradeIdeaId, ticker, snapshotType: snapshot.snapshotType, observedAt: snapshot.observedAt, methodology: snapshot.methodology, values: { underlying_price: snapshot.underlying, event_implied_move_percent: snapshot.eventMove, expiration_implied_move_percent: snapshot.expirationMove, realized_move_percent: snapshot.realizedMove, pre_event_drift_percent: snapshot.preEventDrift, implied_volatility: snapshot.iv, spread_debit: snapshot.debit, two_year_yield: snapshot.twoYear, ten_year_yield: snapshot.tenYear, fed_probability: snapshot.fedProbability, notes: snapshot.notes } }); setSnapshot({ snapshotType: 'market_pricing', observedAt: localDateTime(), methodology: '', underlying: '', eventMove: '', expirationMove: '', realizedMove: '', preEventDrift: '', iv: '', debit: '', twoYear: '', tenYear: '', fedProbability: '', notes: '' }); setMode(''); await onSaved(); setMessage('Append-only snapshot recorded.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Snapshot could not be saved.'); } finally { setBusy(false); } };
  const confirmRemoval = async () => { if (!removal) return; setBusy(true); setMessage(''); try { await removeResearchSnapshot({ snapshotId: removal.item.id, reason: removal.reason, note: removal.note }); setRemoval(undefined); await onSaved(); setMessage('Snapshot removed from active research. Its original audit record was preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Snapshot could not be removed.'); } finally { setBusy(false); } };
  const restore = async (snapshotId: string) => { setBusy(true); setMessage(''); try { await restoreResearchSnapshot(snapshotId); await onSaved(); setMessage('Snapshot restored to active research.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Snapshot could not be restored.'); } finally { setBusy(false); } };

  return <section className="card research-ledger" aria-labelledby={`research-ledger-${catalystId || tradeIdeaId}`}>
    <header className="section-heading"><div><span className="eyebrow">Private audit trail</span><h2 id={`research-ledger-${catalystId || tradeIdeaId}`}>My Research Ledger</h2><p>Personal sources and timestamped observations remain separate from shared facts and conclusions.</p></div><div className="action-row"><button onClick={() => setMode(mode === 'source' ? '' : 'source')}><BookOpen size={15} />Add Source</button><button onClick={() => setMode(mode === 'snapshot' ? '' : 'snapshot')}><Camera size={15} />Add Snapshot</button></div></header>
    {message && <p className="page-message" role="status">{message}</p>}
    {mode === 'source' && <div className="inline-form ledger-form"><div className="form-grid"><label><span>Title</span><input value={source.title} onChange={(event) => setSource({ ...source, title: event.target.value })} /></label><label><span>Publisher</span><input value={source.publisher} onChange={(event) => setSource({ ...source, publisher: event.target.value })} /></label><label className="wide"><span>URL</span><input type="url" value={source.url} onChange={(event) => setSource({ ...source, url: event.target.value })} /></label><label><span>Quality</span><select value={source.sourceQuality} onChange={(event) => setSource({ ...source, sourceQuality: event.target.value as SourceQuality })}>{['official','primary','secondary','unverified'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label><span>Verification</span><select value={source.verified ? 'verified' : 'unverified'} onChange={(event) => setSource({ ...source, verified: event.target.value === 'verified' })}><option value="verified">Verified now</option><option value="unverified">Needs verification</option></select></label><label className="wide"><span>Claim supported</span><textarea value={source.claimSummary} onChange={(event) => setSource({ ...source, claimSummary: event.target.value })} /></label></div><footer><button onClick={() => setMode('')}>Cancel</button><button className="primary" disabled={busy || !source.title.trim() || !source.url.trim()} onClick={() => void addSource()}><Plus size={15} />{busy ? 'Saving' : 'Save Source'}</button></footer></div>}
    {mode === 'snapshot' && <div className="inline-form ledger-form"><div className="form-grid"><label><span>Snapshot type</span><select value={snapshot.snapshotType} onChange={(event) => setSnapshot({ ...snapshot, snapshotType: event.target.value as SnapshotType })}>{['market_pricing','event_implied_move','expiration_implied_move','entry_window','event_reaction','realized_event_move','macro_context'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><label><span>Observed at</span><input type="datetime-local" value={snapshot.observedAt} onChange={(event) => setSnapshot({ ...snapshot, observedAt: event.target.value })} /></label><label><span>Underlying price</span><input inputMode="decimal" value={snapshot.underlying} onChange={(event) => setSnapshot({ ...snapshot, underlying: event.target.value })} /></label><label><span>IV</span><input value={snapshot.iv} onChange={(event) => setSnapshot({ ...snapshot, iv: event.target.value })} /></label><label><span>Event-implied move (%)</span><input inputMode="decimal" value={snapshot.eventMove} onChange={(event) => setSnapshot({ ...snapshot, eventMove: event.target.value })} /></label><label><span>Expiration-implied move (%)</span><input inputMode="decimal" value={snapshot.expirationMove} onChange={(event) => setSnapshot({ ...snapshot, expirationMove: event.target.value })} /></label><label><span>Realized move (%)</span><input inputMode="decimal" value={snapshot.realizedMove} onChange={(event) => setSnapshot({ ...snapshot, realizedMove: event.target.value })} /></label><label><span>Pre-event drift (%)</span><input inputMode="decimal" value={snapshot.preEventDrift} onChange={(event) => setSnapshot({ ...snapshot, preEventDrift: event.target.value })} /></label><label><span>Spread debit</span><input inputMode="decimal" value={snapshot.debit} onChange={(event) => setSnapshot({ ...snapshot, debit: event.target.value })} /></label><label><span>2Y / 10Y yield</span><div className="paired-input"><input aria-label="Two-year yield" value={snapshot.twoYear} onChange={(event) => setSnapshot({ ...snapshot, twoYear: event.target.value })} /><input aria-label="Ten-year yield" value={snapshot.tenYear} onChange={(event) => setSnapshot({ ...snapshot, tenYear: event.target.value })} /></div></label><label><span>Fed probability</span><input value={snapshot.fedProbability} onChange={(event) => setSnapshot({ ...snapshot, fedProbability: event.target.value })} /></label><label className="wide"><span>Methodology</span><textarea value={snapshot.methodology} placeholder="Inputs, horizon, expiration, and calculation method" onChange={(event) => setSnapshot({ ...snapshot, methodology: event.target.value })} /></label><label className="wide"><span>Notes</span><textarea value={snapshot.notes} onChange={(event) => setSnapshot({ ...snapshot, notes: event.target.value })} /></label></div><footer><button onClick={() => setMode('')}>Cancel</button><button className="primary" disabled={busy || !snapshot.observedAt || !snapshot.methodology.trim()} onClick={() => void addSnapshot()}><Plus size={15} />{busy ? 'Saving' : 'Append Snapshot'}</button></footer></div>}
    {removal && <div className="snapshot-removal-form" role="group" aria-label="Remove research snapshot"><h3>Remove this snapshot from active research?</h3><p>Remove this snapshot from active research and analytics? The original observation will remain recoverable and immutable.</p><label><span>Reason</span><select value={removal.reason} onChange={(event) => setRemoval({ ...removal, reason: event.target.value as ResearchSnapshotRemovalReason })}>{reasonOptions.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><label><span>Note (optional)</span><textarea maxLength={500} value={removal.note} onChange={(event) => setRemoval({ ...removal, note: event.target.value })} /></label><footer><button onClick={() => setRemoval(undefined)}>Cancel</button><button className="subtle-danger" disabled={busy} onClick={() => void confirmRemoval()}>Remove from Active Research</button></footer></div>}
    <div className="ledger-grid"><div><h3>Sources</h3>{sources.length ? <div className="ledger-list">{sources.slice(0, 8).map((item) => <article key={item.id}><CatalystSourceLink source={`[${item.title}](${item.url})`} /><span>{item.publisher || label(item.sourceQuality)} · accessed {new Date(item.accessedAt).toLocaleString()}</span>{item.claimSummary && <p>{item.claimSummary}</p>}</article>)}</div> : <p className="muted-copy">No provenance records yet.</p>}</div><div><h3>Snapshots</h3>{snapshots.length ? <div className="research-snapshot-list">{snapshots.slice(0, 8).map((item) => <SnapshotCard key={item.id} item={item} onRemove={(selected) => setRemoval({ item: selected, reason: 'test_snapshot', note: '' })} />)}</div> : <p className="muted-copy">No active pricing snapshots yet.</p>}</div></div>
    <SnapshotComparison snapshots={snapshots} />
    {removed.length > 0 && <details className="removed-snapshots"><summary>Removed Snapshots ({removed.length})</summary><p>Excluded from active research and analytics. Original observations remain unchanged.</p><div>{removed.map(({ snapshot: item, removal: event }) => <article key={item.id}><div><b>{item.ticker || 'Cross-asset'} · {label(item.snapshotType)}</b><span>Removed for {label(event.reason || 'other')} · {new Date(event.createdAt).toLocaleString()}</span>{event.note && <small>{event.note}</small>}</div><button disabled={busy} onClick={() => void restore(item.id)}><RotateCcw size={14} />Restore</button></article>)}</div></details>}
  </section>;
}
