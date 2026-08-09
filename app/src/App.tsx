import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingScreen } from './components/LoadingScreen';
import { AppShell } from './components/layout/AppShell';
import { Workflow } from './components/Workflow';
import { normalizePath, type AppPath } from './config/navigation';
import { loadWorkspace, emptyWorkspace } from './data/workspace';
import { CatalystsPage } from './pages/CatalystsPage';
import { IdeasPage } from './pages/IdeasPage';
import { InsightsPage } from './pages/InsightsPage';
import { JournalPage } from './pages/JournalPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TradesPage } from './pages/TradesPage';
import { remainingSplashTime } from './lib/loading';
import type { Workspace } from './types/domain';

function routeFromHash() { const resolved = normalizePath(); if (resolved.legacy) history.replaceState(null, '', `#${resolved.path}`); return resolved.path; }

export default function App() {
  const [route, setRoute] = useState<AppPath>(routeFromHash); const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [workflow, setWorkflow] = useState<'ticker' | 'catalyst' | null>(null); const [dark, setDark] = useState(() => localStorage.getItem('oj-theme') !== 'light');
  const splashStartedAt = useRef(performance.now()); const splashCompletionScheduled = useRef(false);
  const finishInitialLoad = useCallback(() => {
    if (splashCompletionScheduled.current) return;
    splashCompletionScheduled.current = true;
    const minimum = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : undefined;
    window.setTimeout(() => setLoading(false), remainingSplashTime(splashStartedAt.current, performance.now(), minimum));
  }, []);
  const refresh = useCallback(async () => { try { const next = await loadWorkspace(); setWorkspace(next); setError(''); if (next.preferences?.theme === 'dark') setDark(true); if (next.preferences?.theme === 'light') setDark(false); } catch (cause) { setError(cause instanceof Error ? cause.message : 'OJ could not load.'); } finally { finishInitialLoad(); } }, [finishInitialLoad]);
  useEffect(() => { const hash = () => setRoute(routeFromHash()); window.addEventListener('hashchange', hash); return () => window.removeEventListener('hashchange', hash); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('oj-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { void refresh(); const update = () => void refresh(); const visible = () => { if (document.visibilityState === 'visible') void refresh(); }; window.addEventListener('oj-cloud-workspace-updated', update); window.addEventListener('online', update); document.addEventListener('visibilitychange', visible); const timer = window.setInterval(update, 30000); return () => { window.removeEventListener('oj-cloud-workspace-updated', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', visible); clearInterval(timer); }; }, [refresh]);
  const openRisk = useMemo(() => workspace.positions.filter((item) => item.status === 'active').reduce((sum, item) => sum + (item.maxRisk || 0), 0), [workspace.positions]);
  if (loading) return <LoadingScreen />;
  const page = route === '/' ? <OverviewPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} />
    : route === '/catalysts' ? <CatalystsPage workspace={workspace} onSaved={refresh} />
      : route === '/ideas' ? <IdeasPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} />
        : route === '/trades' ? <TradesPage workspace={workspace} onSaved={refresh} />
          : route === '/journal' ? <JournalPage workspace={workspace} onSaved={refresh} />
            : route === '/insights' ? <InsightsPage workspace={workspace} />
              : <SettingsPage workspace={workspace} onSaved={refresh} />;
  return <><AppShell current={route} dark={dark} onTheme={() => setDark(!dark)} onBuildIdea={() => setWorkflow('ticker')}>{error && <div className="app-error" role="alert">{error}</div>}{workspace.demo && <div className="demo-banner">Synthetic preview data</div>}{!workspace.authenticated && <div className="signed-out-banner">Sign in to load private records. OJ remains usable for local drafts.</div>}{workspace.authenticated && !workspace.approved && <div className="signed-out-banner">This account is waiting for approval.</div>}{page}</AppShell><Workflow open={workflow !== null} onClose={() => setWorkflow(null)} initialMode={workflow || 'ticker'} catalysts={workspace.catalysts.map((item) => ({ id: item.id, event: item.event, date: item.date }))} maximumRisk={workspace.policy?.maximumOpenRisk} openRisk={openRisk} /></>;
}
