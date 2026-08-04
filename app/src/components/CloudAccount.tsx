import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Cloud, LogIn, LogOut } from 'lucide-react';
import { cloudConfigured, supabase } from '../lib/supabase';
import { cloudRowToDraft, hydrateCloud, syncDraft } from '../storage/cloud';
import { listDrafts, saveDraft, type Draft } from '../storage/drafts';

type Conflict = { local: Draft; remote: Draft };

function ConflictCard({ conflict, onResolve }: { conflict: Conflict; onResolve: (choice: 'local' | 'cloud' | 'duplicate' | 'merge', merged?: Record<string, string>) => void }) {
  const keys = [...new Set([...Object.keys(conflict.local.data), ...Object.keys(conflict.remote.data)])];
  const [manual, setManual] = useState(false);
  const [merged, setMerged] = useState({ ...conflict.local.data });
  return (
    <div className="conflict-card">
      <b>{conflict.local.data.Ticker || 'Draft'} changed on two devices</b>
      <p>
        Local: {new Date(conflict.local.updatedAt).toLocaleString()}
        <br />
        Cloud: {new Date(conflict.remote.updatedAt).toLocaleString()}
      </p>
      <details>
        <summary>Compare changes</summary>
        {keys.map((key) => (
          <div className="conflict-field" key={key}>
            <b>{key}</b>
            <span>Local: {conflict.local.data[key] || 'TBD'}</span>
            <span>Cloud: {conflict.remote.data[key] || 'TBD'}</span>
          </div>
        ))}
      </details>
      {manual && (
        <div className="manual-merge">
          {keys.map((key) => (
            <label key={key}>
              {key}
              <textarea value={merged[key] || ''} onChange={(event) => setMerged({ ...merged, [key]: event.target.value })} />
              <small>Cloud version: {conflict.remote.data[key] || 'TBD'}</small>
            </label>
          ))}
          <button onClick={() => onResolve('merge', merged)}>Save merged version</button>
        </div>
      )}
      <div>
        <button onClick={() => onResolve('local')}>Keep local</button>
        <button onClick={() => onResolve('cloud')}>Keep cloud</button>
        <button onClick={() => onResolve('duplicate')}>Duplicate local</button>
        <button onClick={() => setManual(!manual)}>Manually merge</button>
      </div>
    </div>
  );
}

export function CloudAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    supabase?.auth.getUser().then((result) => setUser(result.data.user));
    const subscription = supabase?.auth.onAuthStateChange((_, session) => setUser(session?.user || null));
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  const hydrate = async () => {
    const [cloud, local] = await Promise.all([hydrateCloud(), listDrafts()]);
    const found: Conflict[] = [];
    for (const row of cloud) {
      const old = local.find((candidate) => candidate.id === row.id);
      const remote = cloudRowToDraft(row);
      if (!old) {
        await saveDraft(remote);
        continue;
      }
      const localChanged = ['draft', 'local', 'offline', 'retry', 'outdated', 'conflict'].includes(old.sync);
      const cloudChanged = old.cloudRevision !== remote.cloudRevision;
      if (localChanged && cloudChanged) {
        const localConflict = { ...old, sync: 'conflict' as const };
        await saveDraft(localConflict);
        found.push({ local: localConflict, remote });
      } else if (localChanged) {
        const result = await syncDraft(old);
        await saveDraft(result.draft);
        if (result.state === 'conflict') found.push({ local: result.draft, remote });
      } else if (cloudChanged || remote.updatedAt > old.updatedAt || remote.sync !== old.sync) {
        await saveDraft({
          ...remote,
          formalizationJobId: old.formalizationJobId,
          formalizationStatus: old.formalizationStatus,
          prUrl: old.prUrl,
        });
      }
    }
    setConflicts(found);
    setMessage(found.length ? `${found.length} conflict(s) need a decision.` : cloud.length ? `${cloud.length} cloud draft(s) are current on this device.` : 'Cloud connected; no drafts yet.');
    window.dispatchEvent(new Event('oj-drafts-updated'));
  };

  useEffect(() => {
    if (user) hydrate().catch((error) => setMessage(error instanceof Error ? error.message : 'Cloud hydration failed.'));
  }, [user]);

  useEffect(() => {
    const refresh = () => user && hydrate().catch((error) => setMessage(error instanceof Error ? error.message : 'Cloud hydration failed.'));
    window.addEventListener('oj-cloud-refresh', refresh);
    return () => window.removeEventListener('oj-cloud-refresh', refresh);
  }, [user]);

  const login = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    setMessage(error ? error.message : 'Check your email for the secure sign-in link.');
  };

  const resolve = async (conflict: Conflict, choice: 'local' | 'cloud' | 'duplicate' | 'merge', merged?: Record<string, string>) => {
    try {
      if (choice === 'cloud') await saveDraft(conflict.remote);
      if (choice === 'local' || choice === 'merge') {
        const chosen = choice === 'merge' ? { ...conflict.local, data: merged || conflict.local.data } : conflict.local;
        const result = await syncDraft({ ...chosen, cloudRevision: conflict.remote.cloudRevision, sync: 'local' });
        await saveDraft(result.draft);
      }
      if (choice === 'duplicate') {
        await saveDraft(conflict.remote);
        await saveDraft({
          ...conflict.local,
          id: crypto.randomUUID(),
          sync: 'local',
          cloudRevision: undefined,
          cloudUpdatedAt: undefined,
          formalizationJobId: undefined,
          formalizationStatus: undefined,
          prUrl: undefined,
        });
      }
      setConflicts((current) => current.filter((item) => item.local.id !== conflict.local.id));
      setMessage(`Conflict resolved: ${choice === 'merge' ? 'saved manual merge' : `kept ${choice}`}.`);
      window.dispatchEvent(new Event('oj-drafts-updated'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Conflict resolution failed; both copies remain safe.');
    }
  };

  return (
    <div className="cloud-account">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Open cloud account">
        <Cloud size={16} />
        {!cloudConfigured ? 'Local only' : conflicts.length ? 'Conflict' : user ? 'Cloud connected' : 'Sign in'}
      </button>
      {open && (
        <div className="cloud-popover">
          <b>OJ Cloud</b>
          {!cloudConfigured ? (
            <p>Cloud configuration is absent. Local drafts and emergency packets still work.</p>
          ) : user ? (
            <>
              <p>Signed in as {user.email}. Approved drafts synchronize across devices.</p>
              <button onClick={hydrate}>Refresh cloud</button>
              <button onClick={() => supabase?.auth.signOut()}>
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <p>Use a magic link to continue drafts across your iPhone and Mac.</p>
              <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <button onClick={login} disabled={!email.includes('@')}>
                <LogIn size={15} /> Send magic link
              </button>
            </>
          )}
          {message && <small>{message}</small>}
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.local.id} conflict={conflict} onResolve={(choice, merged) => resolve(conflict, choice, merged)} />
          ))}
          <p className="privacy-note">No brokerage credentials. Owner-only RLS plus approval allowlist.</p>
        </div>
      )}
    </div>
  );
}
