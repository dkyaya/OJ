import { useCallback, useEffect, useState } from 'react';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import { Cloud, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { cloudConfigured, supabase } from '../lib/supabase';
import { cloudRowToDraft, flushPendingOperations, hydrateCloud, syncDraft } from '../storage/cloud';
import { clearAllDrafts, listDrafts, saveDraft, type Draft } from '../storage/drafts';
import { observeAuthState } from './auth-state';

type Conflict = { local: Draft; cloud: Draft };

export function CloudAccount() {
  const [user, setUser] = useState<User | null>(null); const [email, setEmail] = useState(''); const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(''); const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const hydrate = useCallback(async () => {
    await flushPendingOperations(); const [rows, local] = await Promise.all([hydrateCloud(), listDrafts()]); const found: Conflict[] = [];
    for (const row of rows) {
      const cloud = cloudRowToDraft(row as Record<string, unknown>); const cached = local.find((item) => item.id === cloud.id);
      if (!cached) await saveDraft(cloud);
      else if (cached.sync !== 'canonical' && cached.cloudRevision !== cloud.cloudRevision) found.push({ local: { ...cached, sync: 'conflict' }, cloud });
      else if (cloud.cloudRevision !== cached.cloudRevision) await saveDraft(cloud);
    }
    setConflicts(found); setMessage(found.length ? `${found.length} conflict${found.length === 1 ? '' : 's'} need review.` : 'OJ is current on this device.');
    window.dispatchEvent(new Event('oj-cloud-workspace-updated'));
  }, []);

  useEffect(() => {
    return observeAuthState<User, AuthChangeEvent>(supabase?.auth, (event, next) => {
      const previous = localStorage.getItem('oj-cache-owner');
      if (next && previous && previous !== next.id) void clearAllDrafts(); if (next) localStorage.setItem('oj-cache-owner', next.id);
      if (event === 'SIGNED_OUT') { localStorage.removeItem('oj-cache-owner'); void clearAllDrafts(); if ('caches' in window) void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))); }
      setUser(next); window.dispatchEvent(new Event('oj-cloud-workspace-updated'));
    });
  }, []);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const run = () => void hydrate().catch((error) => setMessage(error instanceof Error ? error.message : 'Refresh failed.'));
    run(); window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [hydrate, userId]);

  const login = async () => { if (!supabase) return; const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } }); setMessage(error ? error.message : 'Check your email for the sign-in link.'); };
  const resolve = async (item: Conflict, choice: 'local' | 'cloud' | 'duplicate') => {
    if (choice === 'cloud') await saveDraft(item.cloud);
    if (choice === 'local') await saveDraft((await syncDraft({ ...item.local, cloudRevision: item.cloud.cloudRevision, sync: 'local' })).draft);
    if (choice === 'duplicate') { await saveDraft(item.cloud); await saveDraft({ ...item.local, id: crypto.randomUUID(), cloudRevision: undefined, cloudUpdatedAt: undefined, sync: 'local' }); }
    setConflicts((items) => items.filter((conflict) => conflict.local.id !== item.local.id)); window.dispatchEvent(new Event('oj-cloud-workspace-updated'));
  };

  return <div className="account-control"><button className="account-trigger" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}><Cloud size={16} />{!cloudConfigured ? 'Local' : user ? 'Synced' : 'Sign in'}</button>{open && <section className="account-popover" role="dialog" aria-label="Account">
    <header><b>OJ Account</b><span>{user?.email || 'Not signed in'}</span></header>
    {!cloudConfigured ? <p>Add the browser-safe Supabase URL and publishable key to enable sign-in.</p> : user ? <><p>Canonical records are stored in Supabase and available across devices.</p><button onClick={() => void hydrate()}><RefreshCw size={15} />Refresh</button><button onClick={() => supabase?.auth.signOut({ scope: 'local' })}><LogOut size={15} />Sign Out</button></> : <><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button onClick={() => void login()} disabled={!email.includes('@')}><LogIn size={15} />Send Sign-in Link</button></>}
    {message && <small role="status">{message}</small>}{conflicts.map((item) => <div className="conflict-card" key={item.local.id}><b>{item.local.data.Ticker || 'Idea'} changed on two devices</b><p>Choose which version OJ should keep.</p><div><button onClick={() => void resolve(item, 'cloud')}>Keep Cloud</button><button onClick={() => void resolve(item, 'local')}>Keep Local</button><button onClick={() => void resolve(item, 'duplicate')}>Keep Both</button></div></div>)}
    <small>No brokerage access. Owner-scoped RLS.</small>
  </section>}</div>;
}
