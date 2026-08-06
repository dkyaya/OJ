import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, Copy, Download, ExternalLink, X } from 'lucide-react';
import { portfolioRisk, spreadMetrics, type Spread } from '../lib/payoff';
import { clearDraft, listDrafts, saveDraft, type Draft, type DraftSyncState } from '../storage/drafts';
import { getFormalizationStatus, submitFormalization, syncDraft } from '../storage/cloud';
import { packet } from '../features/packet';

type ResearchMode = 'ticker' | 'catalyst';
type CatalystChoice = { id: string; event: string; date: string };
type Field = { name: string; choices?: string[]; required?: boolean; placeholder?: string };

const baseFields: Field[] = [
  { name: 'Research path', choices: ['Ticker first', 'Catalyst first'], required: true },
  { name: 'Ticker', required: true, placeholder: 'Security being researched' },
  { name: 'Underlying type', choices: ['ETF', 'Stock', 'Index', 'Other'] },
  { name: 'Bias', choices: ['Bullish', 'Bearish', 'Neutral / conditional'], required: true },
  { name: 'Thesis summary', required: true },
  { name: 'Confidence', choices: ['Low', 'Moderate', 'High'] },
  { name: 'Expected move', placeholder: 'TBD until sourced' },
  { name: 'Implied move', placeholder: 'TBD until sourced' },
  { name: 'Catalyst title', placeholder: 'Scheduled event, not a rumor' },
  { name: 'Catalyst date', placeholder: 'YYYY-MM-DD' },
  { name: 'Catalyst category', choices: ['Employment', 'Inflation', 'Central bank', 'Earnings', 'Policy', 'Other'] },
  { name: 'Catalyst cluster', placeholder: 'Group related scheduled events' },
  { name: 'Existing catalyst ID', placeholder: 'Optional: select below' },
  { name: 'Create linked catalyst', choices: ['No', 'Yes'] },
  { name: 'Exposure type', choices: ['direct', 'indirect', 'index', 'sector', 'rates', 'supply-chain', 'peer'] },
  { name: 'Security mapping rationale', placeholder: 'How the event may reach this security' },
  { name: 'Correlation cluster', placeholder: 'Group overlapping thesis risk' },
  { name: 'Score rationale', placeholder: 'Evidence, missing data, and manual adjustments' },
  { name: 'Strategy', choices: ['Bull call spread', 'Bear put spread'], required: true },
  { name: 'Long strike', placeholder: 'TBD until live chain review' },
  { name: 'Short strike', placeholder: 'TBD until live chain review' },
  { name: 'Net debit', placeholder: 'Per-share debit; no assumed price' },
  { name: 'Contracts', placeholder: 'Required for a max-loss calculation' },
  { name: 'Entry conditions', required: true },
  { name: 'Invalidation conditions', required: true },
  { name: 'Hold through events', placeholder: 'One scheduled event per line, if explicitly chosen' },
  { name: 'Avoid events', placeholder: 'One scheduled event per line, if explicitly chosen' },
  { name: 'Planned exit', placeholder: 'Decision boundary, not an automatic order' },
];

const initialFor = (mode: ResearchMode): Record<string, string> => ({
  'Research path': mode === 'catalyst' ? 'Catalyst first' : 'Ticker first',
  Ticker: '',
  'Underlying type': 'ETF',
  Bias: 'Bullish',
  Confidence: 'Moderate',
  Strategy: 'Bull call spread',
  'Create linked catalyst': mode === 'catalyst' ? 'Yes' : 'No',
  'Exposure type': 'direct',
});

const required = baseFields.filter((field) => field.required).map((field) => field.name);
const text = (data: Record<string, string>, name: string) => data[name]?.trim() || '';
const asNumber = (value: string) => (value.trim() && Number.isFinite(Number(value)) ? Number(value) : Number.NaN);

export function SyncMark({ state }: { state: DraftSyncState }) {
  const label: Record<DraftSyncState, string> = {
    draft: 'Saved locally', awaiting: 'Submitted', local: 'Saved locally', syncing: 'Syncing', synced: 'Synced', offline: 'Offline · saved', retry: 'Retry needed', outdated: 'Newer local edit', conflict: 'Conflict', submitted: 'Submitted', pr_open: 'PR open', published: 'Published',
  };
  return <span className={`sync ${state}`} title="Canonical Markdown changes only after pull-request review and manual merge."><i />{label[state]}</span>;
}

export function Workflow({
  open,
  onClose,
  initialMode = 'ticker',
  catalysts = [],
  capacity,
  openRisk = 0,
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: ResearchMode;
  catalysts?: CatalystChoice[];
  capacity?: number | null;
  openRisk?: number;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>(() => initialFor(initialMode));
  const [draft, setDraft] = useState<Draft>();
  const [history, setHistory] = useState<Draft[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const wasOpen = useRef(false);
  const idRef = useRef<string>(crypto.randomUUID());
  const dataRef = useRef(data);
  const draftRef = useRef(draft);
  dataRef.current = data;
  draftRef.current = draft;

  const refreshHistory = useCallback(async () => setHistory(await listDrafts()), []);
  const stepCount = Math.ceil(baseFields.length / 4);
  const slice = baseFields.slice(step * 4, step * 4 + 4);
  const structureStarted = ['Long strike', 'Short strike', 'Net debit', 'Contracts'].some((field) => text(data, field));
  const strategy = text(data, 'Strategy').toLowerCase().replaceAll(' ', '-') as Spread;
  const metrics = spreadMetrics(strategy, asNumber(text(data, 'Long strike')), asNumber(text(data, 'Short strike')), asNumber(text(data, 'Net debit')), Number(text(data, 'Contracts')) || undefined);
  const portfolio = portfolioRisk(openRisk > 0 ? [{ maxLoss: openRisk, isOpen: true }] : [], capacity);
  const candidateTotal = metrics ? openRisk + metrics.maxLoss : openRisk;
  const blocked = metrics && capacity && candidateTotal > capacity;

  useEffect(() => {
    if (open && !wasOpen.current) {
      idRef.current = crypto.randomUUID();
      draftRef.current = undefined;
      setDraft(undefined);
      setData(initialFor(initialMode));
      setStep(0);
      setEditVersion(0);
      setMessage('');
      void refreshHistory();
    }
    wasOpen.current = open;
  }, [initialMode, open, refreshHistory]);

  useEffect(() => {
    const refresh = () => void refreshHistory();
    window.addEventListener('oj-drafts-updated', refresh);
    return () => window.removeEventListener('oj-drafts-updated', refresh);
  }, [refreshHistory]);

  const compose = useCallback((sync?: DraftSyncState): Draft => {
    const current = draftRef.current;
    const finalState = ['submitted', 'pr_open', 'published', 'awaiting'].includes(current?.sync || '');
    return { ...current, id: idRef.current, kind: 'Create trade idea', data: dataRef.current, updatedAt: new Date().toISOString(), sync: sync || (finalState ? 'outdated' : 'local') };
  }, []);

  const saveLocal = useCallback(async (announce = false) => {
    const next = compose();
    await saveDraft(next);
    draftRef.current = next;
    setDraft(next);
    await refreshHistory();
    if (announce) setMessage('Saved on this device. Cloud synchronization remains separate.');
    return next;
  }, [compose, refreshHistory]);

  const syncCloud = useCallback(async (announce = false) => {
    const local = await saveLocal(false);
    const syncing = { ...local, sync: 'syncing' as const };
    draftRef.current = syncing;
    setDraft(syncing);
    try {
      const result = await syncDraft(local);
      await saveDraft(result.draft);
      draftRef.current = result.draft;
      setDraft(result.draft);
      await refreshHistory();
      if (announce || result.state !== 'synced') setMessage(result.message || 'Cloud draft synchronized.');
      if (result.state === 'synced') window.dispatchEvent(new Event('oj-cloud-workspace-updated'));
      return result.draft;
    } catch (error) {
      const retry = { ...local, sync: navigator.onLine ? ('retry' as const) : ('offline' as const) };
      await saveDraft(retry);
      draftRef.current = retry;
      setDraft(retry);
      setMessage(error instanceof Error ? error.message : 'Cloud sync failed. Your local copy is safe.');
      return retry;
    }
  }, [refreshHistory, saveLocal]);

  useEffect(() => {
    if (!open || editVersion === 0) return;
    const localTimer = window.setTimeout(() => void saveLocal(false), 150);
    const cloudTimer = window.setTimeout(() => void syncCloud(false), 1200);
    return () => { window.clearTimeout(localTimer); window.clearTimeout(cloudTimer); };
  }, [editVersion, open, saveLocal, syncCloud]);

  const applyStatus = useCallback(async (current: Draft) => {
    if (!current.formalizationJobId) return;
    try {
      const status = await getFormalizationStatus(current.formalizationJobId);
      const sync: DraftSyncState = status.status === 'published' ? 'published' : ['pull_request_open', 'changes_requested', 'validated', 'merged', 'publishing'].includes(status.status) ? 'pr_open' : status.status === 'failed' ? 'retry' : 'submitted';
      const next = { ...current, sync, formalizationStatus: status.status, prUrl: status.pr_url || current.prUrl, updatedAt: status.updated_at || current.updatedAt };
      await saveDraft(next);
      draftRef.current = next;
      setDraft(next);
    } catch { /* A local receipt remains visible while status polling is unavailable. */ }
  }, []);

  useEffect(() => {
    const current = draftRef.current;
    if (!open || !current?.formalizationJobId) return;
    void applyStatus(current);
    const timer = window.setInterval(() => { if (draftRef.current) void applyStatus(draftRef.current); }, 15000);
    return () => window.clearInterval(timer);
  }, [applyStatus, draft?.formalizationJobId, open]);

  if (!open) return null;

  const update = (name: string, value: string) => {
    setData((current) => ({ ...current, [name]: value }));
    setEditVersion((version) => version + 1);
  };
  const load = (saved: Draft) => {
    idRef.current = saved.id;
    draftRef.current = saved;
    setDraft(saved);
    setData(saved.data);
    setStep(0);
    setMessage(`Loaded ${saved.data.Ticker || 'untitled'} from ${new Date(saved.updatedAt).toLocaleString()}.`);
  };
  const submit = async () => {
    const missing = required.filter((field) => !text(dataRef.current, field));
    if (missing.length) return setMessage(`Complete required fields first: ${missing.join(', ')}.`);
    if (structureStarted && !metrics) return setMessage('For a structure calculation, use valid directional strikes, debit, and an explicit whole-number contract count.');
    if (blocked) return setMessage('This candidate exceeds the current owner-defined maximum-risk capacity. Reduce risk or revisit the policy before formalization.');
    const current = draftRef.current;
    if (!current?.cloudRevision || current.sync !== 'synced') return setMessage('Wait for this exact revision to show Synced before submission.');
    if (!confirm('Submit this research draft for a PRIVATE canonical-journal pull request? You still review and manually merge it. No brokerage action is taken.')) return;
    setBusy(true);
    try {
      const result = await submitFormalization(current);
      const next = { ...current, sync: 'submitted' as const, formalizationJobId: result.job_id, formalizationStatus: result.status, updatedAt: new Date().toISOString() };
      await saveDraft(next);
      draftRef.current = next;
      setDraft(next);
      setMessage(result.reused ? 'This exact revision was already submitted; its private receipt was restored.' : 'Submitted. The private canonical-journal pull request is being prepared.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed. Your local draft and packet remain available.');
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (draftRef.current) await clearDraft(draftRef.current.id);
    idRef.current = crypto.randomUUID();
    draftRef.current = undefined;
    setDraft(undefined);
    setData(initialFor(initialMode));
    setEditVersion(0);
    setStep(0);
    await refreshHistory();
  };

  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-trade-heading">
    <section className="wizard panel catalyst-workflow">
      <button className="close" onClick={onClose} aria-label="Close new trade idea"><X /></button>
      <span className="eyebrow">Research first · local-first · cloud synchronized</span>
      <h2 id="new-trade-heading">New trade idea</h2>
      <p className="workflow-intro">Start from a ticker or a scheduled catalyst. This records research only—OJ cannot access a brokerage or place an order.</p>

      {history.length > 0 && <div className="draft-switcher"><span>Continue a saved draft</span><div>{history.slice(0, 5).map((saved) => <button className={saved.id === draft?.id ? 'selected' : ''} key={saved.id} onClick={() => load(saved)}>{saved.data.Ticker || 'Untitled'} · <SyncMark state={saved.sync} /></button>)}</div></div>}

      <div className="steps">{Array.from({ length: stepCount + 1 }, (_, index) => <b className={index === step ? 'on' : ''} key={index} title={index === stepCount ? 'Review' : `Step ${index + 1}`}>{index + 1}</b>)}</div>

      {step < stepCount ? <div className="form">{slice.map((field) => <label key={field.name}>{field.name}{field.required && <em>Required</em>}
        {field.name === 'Existing catalyst ID' && catalysts.length > 0 && <select value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)}><option value="">Create or choose a scheduled catalyst</option>{catalysts.map((catalyst) => <option value={catalyst.id} key={catalyst.id}>{catalyst.date} · {catalyst.event}</option>)}</select>}
        {field.name === 'Existing catalyst ID' && catalysts.length === 0 && <textarea value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)} placeholder={field.placeholder} />}
        {field.name !== 'Existing catalyst ID' && field.choices && <select value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)}>{field.choices.map((choice) => <option key={choice}>{choice}</option>)}</select>}
        {field.name !== 'Existing catalyst ID' && !field.choices && <textarea value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)} placeholder={field.placeholder || field.name} />}
      </label>)}</div> : <div className="review"><SyncMark state={draft?.sync || 'local'} />
        <p>Review this research revision. Data that is incomplete stays TBD. Cloud synchronization does not alter canonical Markdown; submission opens a private pull request for review and manual merge.</p>
        <p className="public-warning"><b>Private publication boundary:</b> no brokerage credentials, account identifiers, raw confirmations, or automated orders belong in OJ.</p>
        {metrics && <div className={`risk-preview ${blocked ? 'blocked' : ''}`}><b>Defined-risk preview</b><span>Max loss: ${metrics.maxLoss.toFixed(2)} · Max profit: ${metrics.maxProfit.toFixed(2)} · Break-even: {metrics.breakEven.toFixed(2)}</span>{capacity ? <small>{blocked ? 'Blocked by capacity' : `${(portfolio.availableRisk ?? 0).toFixed(2)} available before this candidate`}</small> : <small>Owner capacity is not configured, so this preview does not approve a trade.</small>}</div>}
        {Object.entries(data).filter(([, value]) => value).map(([key, value]) => <p key={key}><b>{key}</b><br />{value}</p>)}
      </div>}

      {draft?.formalizationJobId && <div className="submission-receipt"><b>Submission receipt</b><span>{draft.formalizationStatus || 'formalization_pending'}</span><small>Job {draft.formalizationJobId}</small>{draft.prUrl && /^https:\/\/github\.com\/dkyaya\/OJ-Journal\/pull\/[1-9][0-9]*$/.test(draft.prUrl) && <a href={draft.prUrl} target="_blank" rel="noopener noreferrer">Open pull request <ExternalLink size={14} /></a>}</div>}

      <footer><button onClick={() => step && setStep(step - 1)} disabled={!step}>Back</button>{step < stepCount ? <button className="primary" onClick={async () => { await saveLocal(false); setStep(step + 1); }}>Save & continue</button> : <><button onClick={() => void saveLocal(true)}>Save locally</button><button onClick={() => void syncCloud(true)} disabled={busy || draft?.sync === 'conflict'}><CloudUpload size={15} /> Sync cloud</button><button className="primary" onClick={submit} disabled={busy || draft?.sync !== 'synced'}>Submit for formalization</button></>}</footer>
      {message && <p className="workflow-message">{message}</p>}
      {draft && <div className="packet"><div><b>Emergency Work Update Packet</b><button onClick={() => navigator.clipboard.writeText(packet(draft))}><Copy size={15} /> Copy</button><a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(packet(draft))}`} download="oj-work-update.md"><Download size={15} /> Download</a></div><pre>{packet(draft)}</pre></div>}
      <small>IndexedDB remains the offline cache. <button onClick={reset}>Clear this device copy</button> · {history.length} saved draft(s)</small>
    </section>
  </div>;
}
