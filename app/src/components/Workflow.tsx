import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, Save, X } from 'lucide-react';
import { canonicalFingerprint, ideaToFormData, IDEA_SECTIONS, initialIdeaData, validateIdeaData, visibleFields } from '../features/ideas/canonical';
import { dateKey } from '../lib/calendar';
import { filterSelectableCatalysts } from '../lib/catalyst-filter';
import { spreadMetrics, type Spread } from '../lib/payoff';
import { syncDraft } from '../storage/cloud';
import { clearDraft, listDrafts, saveDraft, type Draft } from '../storage/drafts';
import type { TradeIdea } from '../types/domain';

type CatalystChoice = { id: string; event: string; date?: string };

function SyncState({ state }: { state?: Draft['sync'] }) {
  const label = state === 'canonical' ? 'Saved to OJ' : state === 'syncing' ? 'Saving' : state === 'offline' ? 'Saved offline' : state === 'conflict' ? 'Conflict' : 'Local draft';
  return <span className="sync-state" data-state={state}>{state === 'canonical' ? <Check size={14} /> : <Cloud size={14} />}{label}</span>;
}

export function Workflow({ open, onClose, onSaved, ownerId, initialMode = 'ticker', idea, catalysts = [], maximumRisk, openRisk = 0 }: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  ownerId: string;
  initialMode?: 'ticker' | 'catalyst';
  idea?: TradeIdea;
  catalysts?: CatalystChoice[];
  maximumRisk?: number;
  openRisk?: number;
}) {
  const editing = Boolean(idea);
  const startingData = useMemo(() => idea ? ideaToFormData(idea) : initialIdeaData(initialMode), [idea, initialMode]);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>(startingData);
  const [draft, setDraft] = useState<Draft>();
  const [history, setHistory] = useState<Draft[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const id = useRef<string>(idea?.id || crypto.randomUUID());
  const initialFingerprint = useRef(canonicalFingerprint(startingData));
  const dialog = useRef<HTMLElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const dirty = canonicalFingerprint(data) !== initialFingerprint.current;
  const refreshHistory = useCallback(async () => setHistory(await listDrafts(ownerId)), [ownerId]);

  useEffect(() => {
    if (!open) return;
    const next = idea ? ideaToFormData(idea) : initialIdeaData(initialMode);
    id.current = idea?.id || crypto.randomUUID();
    initialFingerprint.current = canonicalFingerprint(next);
    setData(next);
    setStep(0);
    setMessage('');
    setDraft(idea ? { id: idea.id, ownerId, kind: 'trade_idea', data: next, updatedAt: idea.updatedAt, cloudRevision: idea.revision, cloudUpdatedAt: idea.updatedAt, sync: 'canonical' } : undefined);
    if (!idea) void refreshHistory(); else setHistory([]);
    window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 0);
  }, [idea, initialMode, open, ownerId, refreshHistory]);

  const requestClose = useCallback(() => {
    if (editing && dirty && !window.confirm('Discard your unsaved Idea changes?')) return;
    onClose();
  }, [dirty, editing, onClose]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, requestClose]);

  const metrics = useMemo(() => spreadMetrics(
    (data.Strategy === 'Bull Call Spread' ? 'bull-call-spread' : 'bear-put-spread') as Spread,
    Number(data['Long strike']), Number(data['Short strike']), Number(data['Net debit']), Number(data.Contracts),
  ), [data]);
  const availableRisk = maximumRisk === undefined ? undefined : Math.max(0, maximumRisk - openRisk);
  const compose = useCallback((sync: Draft['sync'] = 'local'): Draft => ({
    id: id.current, ownerId, kind: 'trade_idea', data: dataRef.current,
    updatedAt: new Date().toISOString(), cloudRevision: draft?.cloudRevision,
    cloudUpdatedAt: draft?.cloudUpdatedAt, sync,
  }), [draft?.cloudRevision, draft?.cloudUpdatedAt, ownerId]);

  const saveLocal = useCallback(async () => {
    const next = compose();
    await saveDraft(next);
    setDraft(next);
    if (!editing) await refreshHistory();
    return next;
  }, [compose, editing, refreshHistory]);

  const saveCloud = useCallback(async () => {
    const local = await saveLocal();
    setSaving(true);
    setDraft({ ...local, sync: 'syncing' });
    try {
      const result = await syncDraft(local);
      setDraft(result.draft);
      setMessage(result.message || 'Saved to OJ.');
      if (result.state === 'canonical') {
        initialFingerprint.current = canonicalFingerprint(result.draft.data);
        window.dispatchEvent(new Event('oj-cloud-workspace-updated'));
        await onSaved?.();
      } else if (result.state === 'conflict' || result.state === 'rejected') {
        await onSaved?.();
      }
      return result.draft;
    } catch (error) {
      const retry = { ...local, sync: navigator.onLine ? 'retry' as const : 'offline' as const };
      await saveDraft(retry);
      setDraft(retry);
      setMessage(error instanceof Error ? error.message : 'Save failed. The local copy is safe.');
      return retry;
    } finally { setSaving(false); }
  }, [onSaved, saveLocal]);

  useEffect(() => {
    if (!open) return;
    const localTimer = window.setTimeout(() => void saveLocal(), 250);
    if (editing) return () => clearTimeout(localTimer);
    const cloudTimer = window.setTimeout(() => void saveCloud(), 1500);
    return () => { clearTimeout(localTimer); clearTimeout(cloudTimer); };
  }, [data, editing, open, saveCloud, saveLocal]);

  if (!open) return null;

  const update = (name: string, next: string) => setData((current) => ({ ...current, [name]: next }));
  const load = (item: Draft) => {
    id.current = item.id;
    setDraft(item);
    setData(item.data);
    initialFingerprint.current = canonicalFingerprint(item.data);
    setStep(0);
    setMessage(`Loaded ${item.data.Ticker || 'untitled'} draft.`);
  };
  const reset = async () => {
    if (editing) return requestClose();
    if (draft) await clearDraft(ownerId, draft.id);
    const next = initialIdeaData(initialMode);
    id.current = crypto.randomUUID();
    initialFingerprint.current = canonicalFingerprint(next);
    setDraft(undefined);
    setData(next);
    setStep(0);
    await refreshHistory();
  };
  const finish = async () => {
    const errors = validateIdeaData(data);
    if (errors.length) return setMessage(`Review: ${errors.join('; ')}.`);
    if (editing && !dirty) return setMessage('No changes to save.');
    const saved = await saveCloud();
    if (saved.sync === 'canonical') onClose();
  };
  const current = IDEA_SECTIONS[step];
  const fields = visibleFields(data, step);
  const selectableCatalysts = filterSelectableCatalysts(catalysts, dateKey(new Date()));

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <section className="workflow-sheet" role="dialog" aria-modal="true" aria-labelledby="idea-dialog-title" ref={dialog}>
      <header><div><span className="eyebrow">Private Idea record</span><h2 id="idea-dialog-title">{editing ? `Edit ${idea?.ticker}` : 'Build Idea'}</h2><p>{editing ? 'Update this Idea without changing its identity or linked trade history.' : 'Save research directly to OJ.'} No brokerage action is available.</p></div><button className="icon-button" onClick={requestClose} aria-label="Close idea editor"><X /></button></header>
      {!editing && history.length > 0 && <div className="draft-row" aria-label="Saved drafts">{history.slice(0, 4).map((item) => <button key={item.id} onClick={() => load(item)}>{item.data.Ticker || 'Untitled'} <small>{item.sync}</small></button>)}</div>}
      <nav className="step-nav" aria-label="Idea steps">{IDEA_SECTIONS.map((section, index) => <button key={section.title} className={index === step ? 'active' : ''} onClick={() => setStep(index)}><span>{index + 1}</span>{section.title}</button>)}</nav>
      <div className="workflow-body"><div className="section-intro"><h3>{current.title}</h3><p>{current.subtitle}</p></div><div className="form-grid">
        {fields.map((field) => <label key={field.name}><span>{field.label}{field.required && <em>Required</em>}</span>
          {field.name === 'Existing catalyst ID' ? <select value={data[field.name] || ''} onChange={(event) => update(field.name, event.target.value)}><option value="">Choose a scheduled catalyst</option>{selectableCatalysts.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.event}</option>)}</select>
            : field.options ? <select value={data[field.name] || field.options[0]} onChange={(event) => update(field.name, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
              : field.multiline ? <textarea value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />
                : <input type={field.inputType || 'text'} min={field.inputType === 'number' ? '0' : undefined} step={field.name === 'Contracts' ? '1' : field.inputType === 'number' ? '0.01' : undefined} value={data[field.name] || ''} placeholder={field.placeholder || field.label} onChange={(event) => update(field.name, event.target.value)} />}
        </label>)}
      </div>{step === 3 && <div className="risk-preview"><b>Risk Preview</b>{metrics ? <><span>Maximum loss: ${metrics.maxLoss.toFixed(2)}</span><span>Maximum profit: ${metrics.maxProfit.toFixed(2)}</span><span>Break-even: {metrics.breakEven.toFixed(2)}</span></> : <p>Candidate pricing is optional. Complete all structure values to calculate the spread.</p>}{availableRisk !== undefined && <small>${availableRisk.toFixed(2)} portfolio-risk capacity available. OJ never auto-sizes or sends orders.</small>}</div>}</div>
      <footer><div><SyncState state={draft?.sync} />{message && <span role="status" aria-live="polite">{message}</span>}</div><div><button onClick={editing ? requestClose : reset}>{editing ? 'Cancel' : 'New Draft'}</button><button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</button>{step < IDEA_SECTIONS.length - 1 ? <button className="primary" onClick={() => setStep(step + 1)}>Next</button> : <button className="primary" onClick={() => void finish()} disabled={saving}><Save size={16} />{saving ? 'Saving' : editing ? 'Save Changes' : 'Save Idea'}</button>}</div></footer>
    </section>
  </div>;
}
