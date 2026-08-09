import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, Save, X } from 'lucide-react';
import { spreadMetrics, type Spread } from '../lib/payoff';
import { syncDraft } from '../storage/cloud';
import { clearDraft, listDrafts, saveDraft, type Draft } from '../storage/drafts';

type Field = { name: string; label: string; placeholder?: string; options?: string[]; required?: boolean; multiline?: boolean };
type CatalystChoice = { id: string; event: string; date?: string };

const sections: Array<{ title: string; subtitle: string; fields: Field[] }> = [
  { title: 'Setup', subtitle: 'Name the research object.', fields: [
    { name: 'Research path', label: 'Research path', options: ['Catalyst first', 'Ticker first'], required: true },
    { name: 'Ticker', label: 'Ticker', placeholder: 'SPY', required: true },
    { name: 'Underlying type', label: 'Underlying type', options: ['ETF', 'Equity', 'Index', 'Other'] },
    { name: 'Strategy', label: 'Strategy', options: ['Bear Put Spread', 'Bull Call Spread'], required: true },
    { name: 'Bias', label: 'Bias', options: ['Bearish', 'Bullish', 'Neutral'], required: true },
    { name: 'Status', label: 'Status', options: ['Draft', 'Watchlist', 'Ready', 'Deferred', 'Rejected', 'Invalidated'] },
  ] },
  { title: 'Catalyst', subtitle: 'Link scheduled market context.', fields: [
    { name: 'Existing catalyst ID', label: 'Scheduled catalyst' },
    { name: 'Create linked catalyst', label: 'Create new catalyst', options: ['No', 'Yes'] },
    { name: 'Catalyst title', label: 'Event', placeholder: 'Scheduled release' },
    { name: 'Catalyst date', label: 'Date', placeholder: 'YYYY-MM-DD' },
    { name: 'Catalyst category', label: 'Category', options: ['Employment', 'Inflation', 'Central bank', 'Earnings', 'Policy', 'Other'] },
    { name: 'Sensitivity', label: 'Sensitivity', options: ['Low', 'Medium', 'High'] },
    { name: 'Verification source', label: 'Source', placeholder: 'Official release page' },
  ] },
  { title: 'Research', subtitle: 'Record the decision criteria.', fields: [
    { name: 'Thesis', label: 'Thesis', multiline: true, required: true },
    { name: 'Evidence', label: 'Evidence', multiline: true },
    { name: 'Entry conditions', label: 'Entry conditions', multiline: true },
    { name: 'Invalidation', label: 'Invalidation', multiline: true },
    { name: 'Planned exit', label: 'Planned exit', multiline: true },
    { name: 'Hold through events', label: 'Hold through', multiline: true },
    { name: 'Avoid events', label: 'Avoid', multiline: true },
  ] },
  { title: 'Candidate', subtitle: 'Define one risk-limited structure.', fields: [
    { name: 'Candidate name', label: 'Candidate', options: ['Balanced', 'Aggressive'] },
    { name: 'Long strike', label: 'Long strike', placeholder: 'TBD' },
    { name: 'Short strike', label: 'Short strike', placeholder: 'TBD' },
    { name: 'Net debit', label: 'Net debit', placeholder: 'TBD' },
    { name: 'Contracts', label: 'Contracts', placeholder: '1' },
    { name: 'Confidence', label: 'Confidence', options: ['Low', 'Moderate', 'High'] },
    { name: 'Correlation cluster', label: 'Correlation cluster', placeholder: 'Optional' },
  ] },
];

const initialData = (mode: 'ticker' | 'catalyst') => ({
  'Research path': mode === 'catalyst' ? 'Catalyst first' : 'Ticker first', Strategy: 'Bear Put Spread', Bias: 'Bearish', Status: 'Draft',
  'Create linked catalyst': mode === 'catalyst' ? 'Yes' : 'No', 'Catalyst category': 'Employment', Sensitivity: 'High', 'Candidate name': 'Balanced', Contracts: '1',
});

function SyncState({ state }: { state?: Draft['sync'] }) {
  const label = state === 'canonical' ? 'Saved to OJ' : state === 'syncing' ? 'Saving' : state === 'offline' ? 'Saved offline' : state === 'conflict' ? 'Conflict' : 'Local draft';
  return <span className="sync-state" data-state={state}>{state === 'canonical' ? <Check size={14} /> : <Cloud size={14} />}{label}</span>;
}

export function Workflow({ open, onClose, ownerId, initialMode = 'ticker', catalysts = [], maximumRisk, openRisk = 0 }: {
  open: boolean; onClose: () => void; ownerId: string; initialMode?: 'ticker' | 'catalyst'; catalysts?: CatalystChoice[]; maximumRisk?: number; openRisk?: number;
}) {
  const [step, setStep] = useState(0); const [data, setData] = useState<Record<string, string>>(initialData(initialMode));
  const [draft, setDraft] = useState<Draft>(); const [history, setHistory] = useState<Draft[]>([]); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const id = useRef<string>(crypto.randomUUID()); const dialog = useRef<HTMLElement>(null); const dataRef = useRef(data); dataRef.current = data;
  const refreshHistory = useCallback(async () => setHistory(await listDrafts(ownerId)), [ownerId]);

  useEffect(() => { if (!open) return; setData(initialData(initialMode)); setStep(0); setMessage(''); setDraft(undefined); id.current = crypto.randomUUID(); void refreshHistory(); window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 0); }, [initialMode, open, refreshHistory]);
  useEffect(() => { if (!open) return; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose, open]);

  const metrics = useMemo(() => spreadMetrics(data.Strategy === 'Bull Call Spread' ? 'bull-call-spread' : 'bear-put-spread' as Spread, Number(data['Long strike']), Number(data['Short strike']), Number(data['Net debit']), Number(data.Contracts)), [data]);
  const availableRisk = maximumRisk === undefined ? undefined : Math.max(0, maximumRisk - openRisk);
  const blocked = metrics && availableRisk !== undefined && metrics.maxLoss > availableRisk;
  const compose = useCallback((sync: Draft['sync'] = 'local'): Draft => ({ id: id.current, ownerId, kind: 'trade_idea', data: dataRef.current, updatedAt: new Date().toISOString(), cloudRevision: draft?.cloudRevision, cloudUpdatedAt: draft?.cloudUpdatedAt, sync }), [draft?.cloudRevision, draft?.cloudUpdatedAt, ownerId]);

  const saveLocal = useCallback(async () => { const next = compose(); await saveDraft(next); setDraft(next); await refreshHistory(); return next; }, [compose, refreshHistory]);
  const saveCloud = useCallback(async (announce = false) => {
    const local = await saveLocal(); if (!local.data.Ticker || !local.data.Strategy || !local.data.Bias) { if (announce) setMessage('Add ticker, strategy, and bias before saving to OJ.'); return local; }
    setSaving(true); setDraft({ ...local, sync: 'syncing' });
    try { const result = await syncDraft(local); setDraft(result.draft); await refreshHistory(); if (announce || result.state !== 'canonical') setMessage(result.message || 'Saved to OJ.'); if (result.state === 'canonical') window.dispatchEvent(new Event('oj-cloud-workspace-updated')); return result.draft; }
    catch (error) { const retry = { ...local, sync: navigator.onLine ? 'retry' as const : 'offline' as const }; await saveDraft(retry); setDraft(retry); setMessage(error instanceof Error ? error.message : 'Save failed. The local copy is safe.'); return retry; }
    finally { setSaving(false); }
  }, [refreshHistory, saveLocal]);

  useEffect(() => { if (!open) return; const localTimer = window.setTimeout(() => void saveLocal(), 250); const cloudTimer = window.setTimeout(() => void saveCloud(), 1500); return () => { clearTimeout(localTimer); clearTimeout(cloudTimer); }; }, [data, open, saveCloud, saveLocal]);
  if (!open) return null;

  const update = (name: string, value: string) => setData((current) => ({ ...current, [name]: value }));
  const load = (item: Draft) => { id.current = item.id; setDraft(item); setData(item.data); setStep(0); setMessage(`Loaded ${item.data.Ticker || 'untitled'} draft.`); };
  const reset = async () => { if (draft) await clearDraft(ownerId, draft.id); id.current = crypto.randomUUID(); setDraft(undefined); setData(initialData(initialMode)); setStep(0); await refreshHistory(); };
  const finish = async () => {
    const missing = sections.flatMap((section) => section.fields).filter((field) => field.required && !data[field.name]).map((field) => field.label);
    if (missing.length) return setMessage(`Add required fields: ${missing.join(', ')}.`); if (blocked) return setMessage('This structure exceeds available portfolio risk.');
    const saved = await saveCloud(true); if (saved.sync === 'canonical') onClose();
  };
  const current = sections[step];

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="workflow-sheet" role="dialog" aria-modal="true" aria-labelledby="idea-dialog-title" ref={dialog}>
      <header><div><span className="eyebrow">Research record</span><h2 id="idea-dialog-title">Build Idea</h2><p>Save research directly to OJ. No brokerage action is available.</p></div><button className="icon-button" onClick={onClose} aria-label="Close idea editor"><X /></button></header>
      {history.length > 0 && <div className="draft-row" aria-label="Saved drafts">{history.slice(0, 4).map((item) => <button key={item.id} onClick={() => load(item)}>{item.data.Ticker || 'Untitled'} <small>{item.sync}</small></button>)}</div>}
      <nav className="step-nav" aria-label="Idea steps">{sections.map((section, index) => <button key={section.title} className={index === step ? 'active' : ''} onClick={() => setStep(index)}><span>{index + 1}</span>{section.title}</button>)}</nav>
      <div className="workflow-body"><div className="section-intro"><h3>{current.title}</h3><p>{current.subtitle}</p></div><div className="form-grid">
        {current.fields.map((field) => <label key={field.name}><span>{field.label}{field.required && <em>Required</em>}</span>
          {field.name === 'Existing catalyst ID' ? <select value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)}><option value="">No existing catalyst</option>{catalysts.map((item) => <option key={item.id} value={item.id}>{item.date || 'TBD'} · {item.event}</option>)}</select>
            : field.options ? <select value={data[field.name] || field.options[0]} onChange={(event) => update(field.name, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
              : field.multiline ? <textarea value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />
                : <input value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />}
        </label>)}
      </div>{step === 3 && <div className={`risk-preview ${blocked ? 'blocked' : ''}`}><b>Risk Preview</b>{metrics ? <><span>Maximum loss: ${metrics.maxLoss.toFixed(2)}</span><span>Maximum profit: ${metrics.maxProfit.toFixed(2)}</span><span>Break-even: {metrics.breakEven.toFixed(2)}</span></> : <p>Add valid strikes, debit, and contracts to calculate the spread.</p>}{availableRisk !== undefined && <small>${availableRisk.toFixed(2)} portfolio-risk capacity available.</small>}</div>}</div>
      <footer><div><SyncState state={draft?.sync} />{message && <span role="status">{message}</span>}</div><div><button onClick={reset}>New Draft</button><button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</button>{step < sections.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next</button> : <button className="primary" onClick={() => void finish()} disabled={saving}><Save size={16} />{saving ? 'Saving' : 'Save Idea'}</button>}</div></footer>
    </section>
  </div>;
}
