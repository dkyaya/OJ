import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ProductTour, ProductTourInvitation } from './components/ProductTour';
import { GuidedWalkthrough } from './components/GuidedWalkthrough';
import { AppShell } from './components/layout/AppShell';
import { Workflow } from './components/Workflow';
import { navigate, normalizePath, routeMotionDirection, type AppPath, type RouteMotionDirection } from './config/navigation';
import { loadWorkspace, emptyWorkspace, savePreferences } from './data/workspace';
import { createProductTourState, productTourPreferenceData, productTourSteps, readProductTourState, type ProductTourState, type ProductTourStatus } from './features/tour/product-tour';
import { createGuidedTutorialState, guidedTutorialPreferenceData, guidedTutorialSteps, readGuidedTutorialState, type GuidedTutorialState, type GuidedTutorialStatus } from './features/tour/guided-tutorial';
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
import { WorkspacePage } from './pages/WorkspacePage';
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
  const [routeMotion, setRouteMotion] = useState<RouteMotionDirection>('neutral');
  const [authMode, setAuthMode] = useState<AuthMode>(() => authModeFromUrl(location.href)); const [workflow, setWorkflow] = useState<'ticker' | 'catalyst' | null>(null); const [tradeIdeaId, setTradeIdeaId] = useState<string>(); const [journalTradeId, setJournalTradeId] = useState<string>(); const [dark, setDark] = useState(() => localStorage.getItem('oj-theme') !== 'light');
  const [tourActive, setTourActive] = useState(false); const [tourBusy, setTourBusy] = useState(false); const [tourOverride, setTourOverride] = useState<ProductTourState>();
  const [guidedActive, setGuidedActive] = useState(false); const [guidedOverride, setGuidedOverride] = useState<GuidedTutorialState>(); const [guidedSessionKey, setGuidedSessionKey] = useState(0);
  const splashStartedAt = useRef(performance.now()); const splashCompletionScheduled = useRef(false); const authModeRef = useRef(authMode); const refreshRequest = useRef(0); const routeRef = useRef(route);
  const workspaceRef = useRef(workspace);
  const finishInitialLoad = useCallback(() => {
    if (splashCompletionScheduled.current) return;
    splashCompletionScheduled.current = true;
    const minimum = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : undefined;
    window.setTimeout(() => setLoading(false), remainingSplashTime(splashStartedAt.current, performance.now(), minimum));
  }, []);
  const refresh = useCallback(async () => {
    const request = ++refreshRequest.current;
    try {
      const next = await loadWorkspace();
      if (request !== refreshRequest.current) return;
      workspaceRef.current = next; setWorkspace(next); setError('');
      if (next.preferences?.theme === 'dark') setDark(true); if (next.preferences?.theme === 'light') setDark(false);
    } catch (cause) { if (request === refreshRequest.current) setError(cause instanceof Error ? cause.message : 'OJ could not load.'); }
    finally { if (request === refreshRequest.current) finishInitialLoad(); }
  }, [finishInitialLoad]);
  const finishAuth = useCallback(() => { clearAuthCallback(); setAuthMode('sign-in'); void refresh(); }, [refresh]);

  useEffect(() => { const hash = () => { const next = routeFromHash(); setRouteMotion(routeMotionDirection(routeRef.current, next)); routeRef.current = next; setRoute(next); }; window.addEventListener('hashchange', hash); return () => window.removeEventListener('hashchange', hash); }, []);
  useEffect(() => { authModeRef.current = authMode; }, [authMode]);
  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
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
        refreshRequest.current += 1;
        const previousOwner = localStorage.getItem('oj-cache-owner');
        if (previousOwner) void clearOwnerDrafts(previousOwner);
        localStorage.removeItem('oj-cache-owner'); const cleared = emptyWorkspace(); workspaceRef.current = cleared; setWorkspace(cleared); setWorkflow(null); setTourActive(false); setTourOverride(undefined); setGuidedActive(false); setGuidedOverride(undefined); setGuidedSessionKey((current) => current + 1); if (authModeRef.current !== 'activate') setAuthMode('sign-in');
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const openRisk = useMemo(() => workspace.positions.filter((item) => item.status === 'active').reduce((sum, item) => sum + (item.maxRisk || 0), 0), [workspace.positions]);
  const storedTourState = readProductTourState(workspace.preferences?.data); const tourState = tourOverride || storedTourState;
  const storedGuidedState = readGuidedTutorialState(workspace.preferences?.data); const guidedState = guidedOverride || storedGuidedState;
  useEffect(() => { if (tourOverride && storedTourState.status === tourOverride.status && storedTourState.step === tourOverride.step && storedTourState.version === tourOverride.version) setTourOverride(undefined); }, [storedTourState.status, storedTourState.step, storedTourState.version, tourOverride]);
  useEffect(() => { if (guidedOverride && storedGuidedState.status === guidedOverride.status && storedGuidedState.stage === guidedOverride.stage && storedGuidedState.version === guidedOverride.version) setGuidedOverride(undefined); }, [guidedOverride, storedGuidedState.stage, storedGuidedState.status, storedGuidedState.version]);
  const persistOnboardingState = useCallback(async ({ tour, guided }: { tour?: ProductTourState; guided?: GuidedTutorialState }) => {
    const current = workspaceRef.current; const source = current.preferences;
    let data = source?.data || {};
    if (tour) data = productTourPreferenceData(data, tour);
    if (guided) data = guidedTutorialPreferenceData(data, guided);
    const input = {
      theme: source?.theme || (dark ? 'dark' as const : 'light' as const),
      calendarView: source?.calendarView || 'month' as const,
      compactCards: source?.compactCards || false,
      mobileNavigation: source?.mobileNavigation || ['/' as const, '/catalysts' as const, '/ideas' as const, '/trades' as const],
      data,
    };
    const saved = await savePreferences(input, source?.revision) as Record<string, unknown>;
    const updated = { ...current, preferences: { ...input, revision: Number(saved.revision || (source?.revision || 0) + 1) } };
    workspaceRef.current = updated; setWorkspace(updated); await refresh();
  }, [dark, refresh]);
  const transitionTour = useCallback(async (status: ProductTourStatus, step: number) => {
    const next = createProductTourState(status, step); setTourOverride(next);
    try { await persistOnboardingState({ tour: next }); }
    catch (cause) { setTourOverride(undefined); throw cause; }
  }, [persistOnboardingState]);
  const transitionGuided = useCallback(async (status: GuidedTutorialStatus, stage: number) => {
    const next = createGuidedTutorialState(status, stage); setGuidedOverride(next);
    try { await persistOnboardingState({ guided: next }); }
    catch (cause) { setGuidedOverride(undefined); throw cause; }
  }, [persistOnboardingState]);
  const startTour = useCallback(async (step = 0) => { setTourBusy(true); try { await transitionTour('in_progress', step); setTourActive(true); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tour progress could not be saved.'); } finally { setTourBusy(false); } }, [transitionTour]);
  const startGuided = useCallback(async (restart = false) => { setTourBusy(true); try { const stage = restart ? 0 : ['paused', 'in_progress'].includes(guidedState.status) ? guidedState.stage : 0; if (restart || !['paused', 'in_progress'].includes(guidedState.status)) setGuidedSessionKey((current) => current + 1); await transitionGuided('in_progress', stage); setTourActive(false); setGuidedActive(true); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Guided Walkthrough progress could not be saved.'); } finally { setTourBusy(false); } }, [guidedState.stage, guidedState.status, transitionGuided]);
  const skipOnboarding = useCallback(async () => { setTourBusy(true); const tour = createProductTourState('skipped', 0); const guided = createGuidedTutorialState('skipped', 0); setTourOverride(tour); setGuidedOverride(guided); try { await persistOnboardingState({ tour, guided }); setError(''); } catch (cause) { setTourOverride(undefined); setGuidedOverride(undefined); setError(cause instanceof Error ? cause.message : 'Onboarding preference could not be saved.'); } finally { setTourBusy(false); } }, [persistOnboardingState]);
  if (loading) return <LoadingScreen />;
  const callbackFlow = authMode === 'activate' || authMode === 'reset';
  if ((!workspace.authenticated && !workspace.demo) || callbackFlow) return <AuthScreen mode={authMode} authenticated={workspace.authenticated} onMode={setAuthMode} onComplete={finishAuth} onLocalStateCleared={() => { setWorkspace(emptyWorkspace()); setWorkflow(null); }} />;
  if (workspace.authenticated && !workspace.approved) return <main className="auth-screen"><section className="auth-card" aria-labelledby="invite-required-title"><img src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" /><header><span className="eyebrow">Options Journey</span><h1 id="invite-required-title">Invite Required</h1><p>This email does not have access to OJ.</p></header><button onClick={() => void supabase?.auth.signOut({ scope: 'local' })}><LogOut size={16} />Sign Out This Device</button><footer><span>Private access</span><span>No brokerage connection</span></footer></section></main>;

  const page = route === '/' ? <OverviewPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} />
    : route === '/catalysts' ? <CatalystsPage workspace={workspace} onSaved={refresh} />
      : route === '/ideas' ? <IdeasPage workspace={workspace} onBuildIdea={() => setWorkflow('ticker')} onRecordTrade={(idea) => { setTradeIdeaId(idea.id); navigate('/trades'); }} onSaved={refresh} />
        : route === '/trades' ? <TradesPage workspace={workspace} onSaved={refresh} initialIdeaId={tradeIdeaId} onInitialIdeaConsumed={() => setTradeIdeaId(undefined)} onDebrief={(position) => { setJournalTradeId(position.id); navigate('/journal'); }} />
          : route === '/journal' ? <JournalPage workspace={workspace} onSaved={refresh} initialTradeId={journalTradeId} onInitialTradeConsumed={() => setJournalTradeId(undefined)} />
            : route === '/insights' ? <InsightsPage workspace={workspace} />
              : route === '/workspace' ? <WorkspacePage workspace={workspace} />
                : <SettingsPage workspace={workspace} onSaved={refresh} tourState={tourState} guidedState={guidedState} onStartTour={(step) => void startTour(step)} onStartGuided={(restart) => void startGuided(restart)} />;
  const guidedPage = <GuidedWalkthrough open={guidedActive} state={guidedState} sessionKey={guidedSessionKey} onStage={(stage) => transitionGuided('in_progress', stage)} onPause={async () => { await transitionGuided('paused', guidedState.stage); setGuidedActive(false); }} onFinish={async () => { await transitionGuided('completed', guidedTutorialSteps.length - 1); setGuidedActive(false); setGuidedSessionKey((current) => current + 1); }} onExit={async () => { await transitionGuided('skipped', guidedState.stage); setGuidedActive(false); setGuidedSessionKey((current) => current + 1); }} onRestart={async () => { await transitionGuided('in_progress', 0); setGuidedSessionKey((current) => current + 1); }} />;
  const profile = workspace.profile;
  return <><AppShell current={route} dark={dark} mobileNavigation={workspace.preferences?.mobileNavigation} userId={profile?.id} email={profile?.email} onRefresh={refresh} onTheme={() => setDark(!dark)} onBuildIdea={() => profile && setWorkflow('ticker')}><div className="route-stage" data-motion={routeMotion} key={guidedActive ? 'guided-walkthrough' : route}>{error && <div className="app-error" role="alert">{error}</div>}{workspace.demo && <div className="demo-banner">Synthetic preview data</div>}{guidedActive ? guidedPage : page}</div></AppShell>{profile && !guidedActive && <Workflow open={workflow !== null} onClose={() => setWorkflow(null)} ownerId={profile.id} initialMode={workflow || 'ticker'} catalysts={workspace.catalysts.map((item) => ({ id: item.id, event: item.event, date: item.date }))} maximumRisk={workspace.policy?.maximumOpenRisk} openRisk={openRisk} />}
    {!workspace.demo && tourState.status === 'not_started' && guidedState.status === 'not_started' && !tourActive && !guidedActive && <ProductTourInvitation busy={tourBusy} onQuick={() => startTour(0)} onGuided={() => startGuided(true)} onSkip={skipOnboarding} />}
    {tourActive && <ProductTour state={tourState} catalystId={workspace.catalysts[0]?.id} onStep={(step) => transitionTour('in_progress', step)} onPause={async () => { await transitionTour('in_progress', tourState.step); setTourActive(false); }} onFinish={async () => { await transitionTour('completed', productTourSteps.length - 1); setTourActive(false); }} />}
  </>;
}
