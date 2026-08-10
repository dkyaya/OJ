import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { AppShell } from './components/layout/AppShell';
import { Workflow } from './components/Workflow';
import { normalizePath, type AppPath } from './config/navigation';
import { loadWorkspace, emptyWorkspace } from './data/workspace';
import { authModeFromUrl, type AuthMode } from './lib/auth';
import { remainingSplashTime } from './lib/loading';
import { supabase } from './lib/supabase';
import { CatalystsPage } from './pages/CatalystsPage';
import { IdeasPage } from './pages/IdeasPage';
import { InsightsPage } from './pages/InsightsPage';
import { JournalPage } from './pages/JournalPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TradesPage } from './pages/TradesPage';
import { clearOwnerDrafts } from './storage/drafts';
import type { Workspace } from './types/domain';

function routeFromHash() { const resolved = normalizePath(); if (resolved.legacy) history.replaceState(null, '', `#${resolved.path}`); return resolved.path; }

function clearAuthCallback() {
  const url = new URL(location.href);
  ['auth', 'code', 'error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash || '#/'}`);
}

export default function App() {
  const [route, setRoute] = useState<AppPath>(routeFromHash); const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>(() => authModeFromUrl(location.href)); const [workflow, setWorkflow] = useState<'ticker' | 'catalyst' | null>(null); const [dark, setDark] = useState(() => localStorage.getItem('oj-theme') !== 'light');
  const splashStartedAt = useRef(performance.now()); const splashCompletionScheduled = useRef(false); const authModeRef = useRef(authMode);
  const finishInitialLoad = useCallback(() => {
    if (splashCompletionScheduled.current) return;
    splashCompletionScheduled.current = true;
    const minimum = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : undefined;
    window.setTimeout(() => setLoading(false), remainingSplashTime(splashStartedAt.current, performance.now(), minimum));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await loadWorkspace(); setWorkspace(next); setError('');
      if (next.preferences?.theme === 'dark') setDark(true); if (next.preferences?.theme === 'light') setDark(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'OJ could not load.'); }
    finally { finishInitialLoad(); }
  }, [finishInitialLoad]);
  const finishAuth = useCallback(() => { clearAuthCallback(); setAuthMode('sign-in'); void refresh(); }, [refresh]);

  useEffect(() => { const hash = () => setRoute(routeFromHash()); window.addEventListener('hashchange', hash); return () => window.removeEventListener('hashchange', hash); }, []);
  useEffect(() => { authModeRef.current = authMode; }, [authMode]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('oj-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    void refresh();
    const update = () => void refresh(); const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('oj-cloud-workspace-updated', update); window.addEventListener('online', update); document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(update, 30000);
    return () => { window.removeEventListener('oj-cloud-workspace-updated', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', visible); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setAuthMode('reset');
      if (event === 'SIGNED_OUT') {
        const previousOwner = localStorage.getItem('oj-cache-owner');
        if (previousOwner) void clearOwnerDrafts(previousOwner);
        localStorage.removeItem('oj-cache-owner'); setWorkspace(emptyWorkspace()); setWorkflow(null); if (authModeRef.current !== 'activate') setAuthMode('sign-in');
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const openRisk = useMemo(() => workspace.positions.filter((item) => item.status === 'active').reduce((sum, item) => sum + (item.maxRisk || 0), 0), [workspace.positions]);
  if (loading) return <LoadingScreen />;
  const callbackFlow = authMode === 'activate' || authMode === 'reset';
  if ((!workspace.authenticated && !workspace.demo) || callbackFlow) return <AuthScreen mode={authMode} authenticated={workspace.authenticated} onMode={setAuthMode} onComplete={finishAuth} onLocalStateCleared={() => { setWorkspace(emptyWorkspace()); setWorkflow(null); }} />;
  if (workspace.authenticated && !workspace.approved) return <main className="auth-screen"><section className="auth-card" aria-labelledby="invite-required-title"><img src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" /><header><span className="eyebrow">Options Journey</span><h1 id="invite-required-title">Invite Required</h1><p>This email does not have access to OJ.</p></header><button onClick={() => void supabase?.auth.signOut({ scope: 'local' })}><LogOut size={16} />Sign Out This Device</button><footer><span>Private access</span><span>No brokerage connection</span></footer></section></main>;

  const page = route === '/' ? <OverviewPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} />
    : route === '/catalysts' ? <CatalystsPage workspace={workspace} onSaved={refresh} />
      : route === '/ideas' ? <IdeasPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} />
        : route === '/trades' ? <TradesPage workspace={workspace} onSaved={refresh} />
          : route === '/journal' ? <JournalPage workspace={workspace} onSaved={refresh} />
            : route === '/insights' ? <InsightsPage workspace={workspace} />
              : <SettingsPage workspace={workspace} onSaved={refresh} />;
  const profile = workspace.profile;
  return <><AppShell current={route} dark={dark} userId={profile?.id} email={profile?.email} onRefresh={refresh} onTheme={() => setDark(!dark)} onBuildIdea={() => profile && setWorkflow('ticker')}>{error && <div className="app-error" role="alert">{error}</div>}{workspace.demo && <div className="demo-banner">Synthetic preview data</div>}{page}</AppShell>{profile && <Workflow open={workflow !== null} onClose={() => setWorkflow(null)} ownerId={profile.id} initialMode={workflow || 'ticker'} catalysts={workspace.catalysts.map((item) => ({ id: item.id, event: item.event, date: item.date }))} maximumRisk={workspace.policy?.maximumOpenRisk} openRisk={openRisk} />}</>;
}
