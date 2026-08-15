import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud } from 'lucide-react';
import { canonicalFingerprint, ideaToFormData, initialIdeaData, validateIdeaData } from '../features/ideas/canonical';
import { syncDraft } from '../storage/cloud';
import { clearDraft, listDrafts, saveDraft, type Draft } from '../storage/drafts';
import type { TradeIdea } from '../types/domain';
import { IdeaEditorSurface } from './editors/IdeaEditorSurface';

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
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <IdeaEditorSurface data={data} step={step} onStep={setStep} onChange={setData} catalysts={catalysts} maximumRisk={maximumRisk} openRisk={openRisk} title={editing ? `Edit ${idea?.ticker}` : 'Build Idea'} description={`${editing ? 'Update this Idea without changing its identity or linked trade history.' : 'Save research directly to OJ.'} No brokerage action is available.`} beforeNav={!editing && history.length > 0 ? <div className="draft-row" aria-label="Saved drafts">{history.slice(0, 4).map((item) => <button key={item.id} onClick={() => load(item)}>{item.data.Ticker || 'Untitled'} <small>{item.sync}</small></button>)}</div> : undefined} status={<SyncState state={draft?.sync} />} message={message} saving={saving} saveLabel={editing ? 'Save Changes' : 'Save Idea'} onSave={finish} onCancel={requestClose} onReset={reset} resetLabel={editing ? 'Cancel' : 'New Draft'} containerRef={dialog} modal />
  </div>;
}
