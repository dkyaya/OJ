import { useCallback, useEffect, useState } from 'react';
import { Cloud, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cloudRowToDraft, flushPendingOperations, hydrateCloud, syncDraft } from '../storage/cloud';
import { clearOwnerDrafts, listDrafts, saveDraft, type Draft } from '../storage/drafts';

type Conflict = { local: Draft; cloud: Draft };

export function CloudAccount({ userId, email, onRefresh }: { userId: string; email: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState(''); const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const hydrate = useCallback(async () => {
    await flushPendingOperations(userId);
    const [rows, local] = await Promise.all([hydrateCloud(userId), listDrafts(userId)]); const found: Conflict[] = [];
    for (const row of rows) {
      const cloud = cloudRowToDraft(row as Record<string, unknown>, userId); const cached = local.find((item) => item.id === cloud.id);
      if (!cached) await saveDraft(cloud);
      else if (cached.sync !== 'canonical' && cached.cloudRevision !== cloud.cloudRevision) found.push({ local: { ...cached, sync: 'conflict' }, cloud });
      else if (cloud.cloudRevision !== cached.cloudRevision) await saveDraft(cloud);
    }
    setConflicts(found); setMessage(found.length ? `${found.length} conflict${found.length === 1 ? '' : 's'} need review.` : 'OJ is current on this device.');
    onRefresh();
  }, [onRefresh, userId]);

  useEffect(() => {
    const run = () => void hydrate().catch(() => setMessage('OJ could not refresh. Try again.'));
    run(); window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [hydrate]);

  const signOut = async () => {
    await clearOwnerDrafts(userId);
    localStorage.removeItem('oj-cache-owner');
    if ('caches' in window) await caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    await supabase?.auth.signOut({ scope: 'local' });
  };

  const resolve = async (item: Conflict, choice: 'local' | 'cloud' | 'duplicate') => {
    if (choice === 'cloud') await saveDraft(item.cloud);
    if (choice === 'local') await saveDraft((await syncDraft({ ...item.local, cloudRevision: item.cloud.cloudRevision, sync: 'local' })).draft);
    if (choice === 'duplicate') { await saveDraft(item.cloud); await saveDraft({ ...item.local, id: crypto.randomUUID(), cloudRevision: undefined, cloudUpdatedAt: undefined, sync: 'local' }); }
    setConflicts((items) => items.filter((conflict) => conflict.local.id !== item.local.id)); onRefresh();
  };

  return <div className="account-control"><button className="account-trigger" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}><Cloud size={16} />Synced</button>{open && <section className="account-popover" role="dialog" aria-label="Account">
    <header><b>OJ Account</b><span>{email}</span></header>
    <p>Canonical records are stored in Supabase and available across your signed-in devices.</p>
    <button onClick={() => void hydrate()}><RefreshCw size={15} />Refresh</button><button onClick={() => void signOut()}><LogOut size={15} />Sign Out This Device</button>
    {message && <small role="status">{message}</small>}{conflicts.map((item) => <div className="conflict-card" key={item.local.id}><b>{item.local.data.Ticker || 'Idea'} changed on two devices</b><p>Choose which version OJ should keep.</p><div><button onClick={() => void resolve(item, 'cloud')}>Keep Cloud</button><button onClick={() => void resolve(item, 'local')}>Keep Local</button><button onClick={() => void resolve(item, 'duplicate')}>Keep Both</button></div></div>)}
    <small>No brokerage access. Account-isolated cache and RLS.</small>
  </section>}</div>;
}
