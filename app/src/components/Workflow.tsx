import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, Copy, Download, ExternalLink, X } from 'lucide-react';
import { clearDraft, listDrafts, saveDraft, type Draft, type DraftSyncState } from '../storage/drafts';
import { getFormalizationStatus, submitFormalization, syncDraft } from '../storage/cloud';
import { packet } from '../features/packet';

const fields = [
  'Ticker',
  'Bias',
  'Strategy',
  'Thesis summary',
  'Confidence',
  'Expected move',
  'Expected timeframe',
  'Catalyst',
  'Entry conditions',
  'Invalidation conditions',
  'Planned exit',
  'Balanced candidate',
  'Aggressive candidate',
];
const required = ['Ticker', 'Bias', 'Strategy', 'Thesis summary', 'Entry conditions', 'Invalidation conditions'];
const initial = { Ticker: '', Bias: 'Bullish', Strategy: 'Bull call spread', Confidence: 'Moderate' };

export function SyncMark({ state }: { state: DraftSyncState }) {
  const label: Record<DraftSyncState, string> = {
    draft: 'Saved locally',
    awaiting: 'Submitted',
    local: 'Saved locally',
    syncing: 'Syncing',
    synced: 'Synced',
    offline: 'Offline · saved',
    retry: 'Retry needed',
    outdated: 'Newer local edit',
    conflict: 'Conflict',
    submitted: 'Submitted',
    pr_open: 'PR open',
    published: 'Published',
  };
  return (
    <span className={`sync ${state}`} title="Canonical Markdown changes only after pull-request review and manual merge.">
      <i />
      {label[state]}
    </span>
  );
}

export function Workflow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>(initial);
  const [draft, setDraft] = useState<Draft>();
  const [history, setHistory] = useState<Draft[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const idRef = useRef<string>(crypto.randomUUID());
  const dataRef = useRef(data);
  const draftRef = useRef(draft);
  dataRef.current = data;
  draftRef.current = draft;

  const refreshHistory = useCallback(async () => setHistory(await listDrafts()), []);

  useEffect(() => {
    if (open) refreshHistory();
  }, [open, refreshHistory]);

  useEffect(() => {
    const refresh = () => void refreshHistory();
    window.addEventListener('oj-drafts-updated', refresh);
    return () => window.removeEventListener('oj-drafts-updated', refresh);
  }, [refreshHistory]);

  const compose = useCallback((sync?: DraftSyncState): Draft => {
    const current = draftRef.current;
    const finalState = ['submitted', 'pr_open', 'published', 'awaiting'].includes(current?.sync || '');
    return {
      ...current,
      id: idRef.current,
      kind: 'Create trade idea',
      data: dataRef.current,
      updatedAt: new Date().toISOString(),
      sync: sync || (finalState ? 'outdated' : 'local'),
    };
  }, []);

  const saveLocal = useCallback(
    async (announce = false) => {
      const next = compose();
      await saveDraft(next);
      draftRef.current = next;
      setDraft(next);
      await refreshHistory();
      if (announce) setMessage('Saved on this device. Cloud synchronization continues separately.');
      return next;
    },
    [compose, refreshHistory],
  );

  const syncCloud = useCallback(
    async (announce = false) => {
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
        if (result.state === 'conflict') window.dispatchEvent(new Event('oj-cloud-refresh'));
        return result.draft;
      } catch (error) {
        const retry = { ...local, sync: navigator.onLine ? ('retry' as const) : ('offline' as const) };
        await saveDraft(retry);
        draftRef.current = retry;
        setDraft(retry);
        setMessage(error instanceof Error ? error.message : 'Cloud sync failed. Your local copy is safe.');
        return retry;
      }
    },
    [refreshHistory, saveLocal],
  );

  useEffect(() => {
    if (!open || editVersion === 0) return;
    const localTimer = window.setTimeout(() => void saveLocal(false), 150);
    const cloudTimer = window.setTimeout(() => void syncCloud(false), 1200);
    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(cloudTimer);
    };
  }, [editVersion, open, saveLocal, syncCloud]);

  useEffect(() => {
    const retry = () => {
      if (open && draftRef.current?.sync !== 'conflict') void syncCloud(true);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [open, syncCloud]);

  const applyStatus = useCallback(
    async (current: Draft) => {
      if (!current.formalizationJobId) return;
      try {
        const status = await getFormalizationStatus(current.formalizationJobId);
        const sync: DraftSyncState =
          status.status === 'published'
            ? 'published'
          : status.status === 'pull_request_open' || status.status === 'changes_requested' || status.status === 'validated' || status.status === 'merged' || status.status === 'publishing'
              ? 'pr_open'
              : status.status === 'failed'
                ? 'retry'
                : 'submitted';
        const next = {
          ...current,
          sync,
          formalizationStatus: status.status,
          prUrl: status.pr_url || current.prUrl,
          updatedAt: status.updated_at || current.updatedAt,
        };
        await saveDraft(next);
        draftRef.current = next;
        setDraft(next);
      } catch {
        // The local receipt remains authoritative while status polling is temporarily unavailable.
      }
    },
    [],
  );

  useEffect(() => {
    const current = draftRef.current;
    if (!open || !current?.formalizationJobId) return;
    void applyStatus(current);
    const timer = window.setInterval(() => {
      if (draftRef.current) void applyStatus(draftRef.current);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [applyStatus, draft?.formalizationJobId, open]);

  if (!open) return null;

  const slice = fields.slice(step * 4, step * 4 + 4);
  const text = draft && packet(draft);
  const load = (saved: Draft) => {
    idRef.current = saved.id;
    draftRef.current = saved;
    setDraft(saved);
    setData(saved.data);
    setStep(0);
    setMessage(`Loaded ${saved.data.Ticker || 'untitled'} from ${new Date(saved.updatedAt).toLocaleString()}.`);
  };
  const submit = async () => {
    const current = draftRef.current;
    const missing = required.filter((field) => !dataRef.current[field]?.trim());
    if (missing.length) return setMessage(`Complete required fields first: ${missing.join(', ')}.`);
    if (!current?.cloudRevision || current.sync !== 'synced') {
      return setMessage('Wait for this exact revision to show Synced before submission.');
    }
    if (!confirm('Submit this exact revision to a PUBLIC GitHub pull-request branch? Do not continue if any field contains private notes, balances, account details, credentials, or identifying information. You will still review and manually merge it.')) return;

    setBusy(true);
    try {
      const result = await submitFormalization(current);
      const next = {
        ...current,
        sync: 'submitted' as const,
        formalizationJobId: result.job_id,
        formalizationStatus: result.status,
        updatedAt: new Date().toISOString(),
      };
      await saveDraft(next);
      draftRef.current = next;
      setDraft(next);
      setMessage(result.reused ? 'This exact revision was already submitted; its existing receipt was restored.' : 'Submitted. The automated pull request is being prepared.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Submission failed. Your local draft and packet remain available.');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (draftRef.current) await clearDraft(draftRef.current.id);
    idRef.current = crypto.randomUUID();
    draftRef.current = undefined;
    setDraft(undefined);
    setData(initial);
    setEditVersion(0);
    setStep(0);
    await refreshHistory();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-trade-heading">
      <section className="wizard panel">
        <button className="close" onClick={onClose} aria-label="Close new trade idea">
          <X />
        </button>
        <span className="eyebrow">Local-first · cloud synchronized</span>
        <h2 id="new-trade-heading">New trade idea</h2>

        {history.length > 0 && (
          <div className="draft-switcher">
            <span>Continue a saved draft</span>
            <div>
              {history.slice(0, 5).map((saved) => (
                <button className={saved.id === draft?.id ? 'selected' : ''} key={saved.id} onClick={() => load(saved)}>
                  {saved.data.Ticker || 'Untitled'} · <SyncMark state={saved.sync} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="steps">
          {['Thesis', 'Catalysts', 'Structures', 'Rules', 'Review'].map((name, index) => (
            <b className={index === step ? 'on' : ''} key={name} title={name}>
              {index + 1}
            </b>
          ))}
        </div>

        {step < 4 ? (
          <div className="form">
            {slice.map((name) => (
              <label key={name}>
                {name}
                {required.includes(name) && <em>Required</em>}
                <textarea
                  value={data[name] || ''}
                  onChange={(event) => {
                    setData({ ...data, [name]: event.target.value });
                    setEditVersion((version) => version + 1);
                  }}
                  placeholder={name.includes('candidate') ? 'TBD until live pricing' : name}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="review">
            <SyncMark state={draft?.sync || 'local'} />
            <p>
              Review this revision. Candidate numbers remain TBD unless explicitly supplied. Cloud synchronization does not alter canonical Markdown; submission creates a pull request for Codex review and your manual merge.
            </p>
            <p className="public-warning"><b>Public-repository boundary:</b> submitted fields enter a public GitHub branch. Keep private notes, balances, account details, credentials, screenshots, and identifying information in the authenticated cloud only.</p>
            {Object.entries(data)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <p key={key}>
                  <b>{key}</b>
                  <br />
                  {value}
                </p>
              ))}
          </div>
        )}

        {draft?.formalizationJobId && (
          <div className="submission-receipt">
            <b>Submission receipt</b>
            <span>{draft.formalizationStatus || 'formalization_pending'}</span>
            <small>Job {draft.formalizationJobId}</small>
            {draft.prUrl && (
              <a href={draft.prUrl} target="_blank" rel="noreferrer">
                Open pull request <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        <footer>
          <button onClick={() => step && setStep(step - 1)} disabled={!step}>
            Back
          </button>
          {step < 4 ? (
            <button
              className="primary"
              onClick={async () => {
                await saveLocal(false);
                setStep(step + 1);
              }}
            >
              Save & continue
            </button>
          ) : (
            <>
              <button onClick={() => void saveLocal(true)}>Save locally</button>
              <button onClick={() => void syncCloud(true)} disabled={busy || draft?.sync === 'conflict'}>
                <CloudUpload size={15} /> Sync cloud
              </button>
              <button className="primary" onClick={submit} disabled={busy || draft?.sync !== 'synced'}>
                Submit for formalization
              </button>
            </>
          )}
        </footer>

        {message && <p className="workflow-message">{message}</p>}
        {text && (
          <div className="packet">
            <div>
              <b>Emergency Work Update Packet</b>
              <button onClick={() => navigator.clipboard.writeText(text)}>
                <Copy size={15} /> Copy
              </button>
              <a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`} download="oj-work-update.md">
                <Download size={15} /> Download
              </a>
            </div>
            <pre>{text}</pre>
          </div>
        )}
        <small>
          IndexedDB remains the offline cache. <button onClick={reset}>Clear this device copy</button> · {history.length} saved draft(s)
        </small>
      </section>
    </div>
  );
}
