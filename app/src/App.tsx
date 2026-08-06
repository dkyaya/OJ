import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, BarChart3, BookOpen, CalendarDays, ClipboardCheck, Lightbulb, Menu, Plus, Settings, ShieldCheck, Target, X } from 'lucide-react';
import { Workflow } from './components/Workflow';
import { portfolioRisk } from './lib/payoff';
import { supabase } from './lib/supabase';

type Candidate = { name: string; width: string; debit: string; risk: string; summary: string };
type Trade = { id: string; ticker: string; strategy: string; bias: string; confidence: string; status: string; entryStatus: string; correlationCluster: string; risk: number | null; candidates: Candidate[] };
type Catalyst = { id: string; date: string; event: string; sensitivity: string; holdThrough: string; ticker: string; type: string; cluster: string; source: string };
type Opportunity = { id: string; catalystId: string; ticker: string; exposure: string; sensitivity: string; status: string; cluster: string; rationale: string; scores: Record<string, unknown> };
type AccountPolicy = { total: number; capacity: number; strategies: string[]; effectiveDate: string };
type ResearchMode = 'ticker' | 'catalyst';

const navigation = [
  ['/', 'Overview', Activity], ['/trade-ideas', 'Trade ideas', Lightbulb], ['/active-trades', 'Active', Target],
  ['/closed-trades', 'Closed', ClipboardCheck], ['/research', 'Research', BookOpen], ['/catalysts', 'Catalyst radar', CalendarDays],
  ['/analytics', 'Analytics', BarChart3], ['/journal', 'Journal', BookOpen], ['/settings', 'Settings', Settings],
] as const;
type RoutePath = typeof navigation[number][0];

const currentHashPath = (): RoutePath => {
  const requested = window.location.hash.slice(1) || '/';
  return navigation.some(([path]) => path === requested) ? requested as RoutePath : '/';
};
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const money = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : 'TBD');
const numberFrom = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null);
const category = (item: Catalyst) => item.type === 'earnings' || /earnings/i.test(item.event) ? 'earn' : item.type === 'inflation' || /CPI|PPI|inflation/i.test(item.event) ? 'inflation' : item.type === 'central-bank' ? 'policy' : 'macro';

const demoWorkspace = {
  policy: { total: 5000, capacity: 1000, strategies: ['bull-call-spread', 'bear-put-spread'], effectiveDate: 'Illustrative' } satisfies AccountPolicy,
  trades: [{ id: 'demo-trade', ticker: 'DEMO', strategy: 'bear-put-spread', bias: 'Conditional', confidence: 'Moderate', status: 'cloud_draft', entryStatus: 'not-entered', correlationCluster: 'illustrative-index', risk: null, candidates: [{ name: 'Illustrative', width: 'Structure TBD', debit: 'TBD', risk: 'TBD', summary: 'Synthetic development fixture. No market data or order is represented.' }] }] satisfies Trade[],
  catalysts: [
    { id: 'demo-1', date: '2026-09-08', event: 'Illustrative scheduled macro release', sensitivity: 'High', holdThrough: 'Research only', ticker: 'DEMO', type: 'macro', cluster: 'illustrative-macro', source: 'Synthetic development fixture' },
    { id: 'demo-2', date: '2026-09-11', event: 'Illustrative inflation release', sensitivity: 'Medium', holdThrough: 'Avoid by default', ticker: 'DEMO', type: 'inflation', cluster: 'illustrative-inflation', source: 'Synthetic development fixture' },
    { id: 'demo-3', date: '2026-09-17', event: 'Illustrative policy minutes', sensitivity: 'Medium', holdThrough: 'Research only', ticker: 'DEMO', type: 'central-bank', cluster: 'illustrative-policy', source: 'Synthetic development fixture' },
  ] satisfies Catalyst[],
  opportunities: [{ id: 'demo-map', catalystId: 'demo-1', ticker: 'DEMO', exposure: 'direct', sensitivity: 'High', status: 'researching', cluster: 'illustrative-index', rationale: 'Synthetic mapping for responsive and interaction review.', scores: { dataCompleteness: 'insufficient evidence' } }] satisfies Opportunity[],
};

function NavItem({ to, current, children, onClick }: { to: RoutePath; current: RoutePath; children: ReactNode; onClick?: () => void }) {
  return <a className={current === to ? 'active' : ''} href={`#${to}`} onClick={onClick}>{children}</a>;
}

function Page({ title, tag, actions, children }: { title: string; tag: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">{tag}</span><h1>{title}</h1></div>{actions}</div>{children}</section>;
}

function MobileMenu({ onIdea, current }: { onIdea: () => void; current: RoutePath }) {
  const [open, setOpen] = useState(false);
  return <div className="mobile-menu"><button className="menu-trigger" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>{open && <div className="menu-sheet"><button className="mobile-idea" onClick={() => { onIdea(); setOpen(false); }}><Plus />New trade idea</button>{navigation.map(([to, label, Icon]) => <NavItem key={to} to={to} current={current} onClick={() => setOpen(false)}><Icon size={18} />{label}</NavItem>)}</div>}</div>;
}

function Shell({ children, current, onIdea }: { children: ReactNode; current: RoutePath; onIdea: () => void }) {
  const [dark, setDark] = useState(true);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  return <div className="shell"><aside className="sidebar"><img className="logo" src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" /><nav>{navigation.map(([to, label, Icon]) => <NavItem key={to} to={to} current={current}><Icon size={18} />{label}</NavItem>)}</nav><button className="new-trade" onClick={onIdea}><Plus size={16} />New trade idea</button><div className="privacy"><ShieldCheck size={17} />Research only<br />No brokerage access</div></aside><main><header className="topbar"><div><span className="eyebrow">Private decision journal</span><strong>Options Journey</strong></div><div className="top-actions"><button className="theme" onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button></div></header>{children}</main><MobileMenu current={current} onIdea={onIdea} /></div>;
}

function RiskPanel({ policy, trades }: { policy?: AccountPolicy; trades: Trade[] }) {
  const portfolio = portfolioRisk(trades.map((trade) => ({ maxLoss: trade.risk, correlationCluster: trade.correlationCluster, isOpen: trade.entryStatus === 'active' })), policy?.capacity);
  if (!policy) return <section className="hero panel"><div><span className="eyebrow">Private capital context</span><h2>Sign in <small>to view account metrics</small></h2><p>Exact balances and private performance load only from authenticated, owner-scoped cloud records.</p></div><div className="risk"><div className="ring"><div><b>—</b><span>private</span></div></div><p>owner-only view</p></div><div className="metrics"><div><span>Open defined risk</span><b>Private</b></div><div><span>Available capacity</span><b>Private</b></div><div><span>Realized P&amp;L</span><b>Private</b></div><div><span>Unrealized P&amp;L</span><b>Private</b></div></div></section>;
  const percent = portfolio.capacityPercent ?? 0;
  return <section className="hero panel"><div><span className="eyebrow">Owner portfolio risk</span><h2>{money(portfolio.availableRisk)} <small>available defined-risk capacity</small></h2><p>Open maximum loss is summed from owner records with explicit quantity and debit. It is not a trading recommendation.</p></div><div className="risk"><div className={`ring ${portfolio.state || ''}`} style={{ background: `conic-gradient(var(--orange) ${Math.min(percent, 100)}%, var(--pulp) 0)` }}><div><b>{Math.round(percent)}%</b><span>{portfolio.state || 'TBD'}</span></div></div><p>of configured capacity</p></div><div className="metrics"><div><span>Open defined risk</span><b>{money(portfolio.totalRisk)}</b></div><div><span>Configured capacity</span><b>{money(policy.capacity)}</b></div><div><span>Account capital</span><b>{money(policy.total)}</b></div><div><span>Effective</span><b>{policy.effectiveDate || 'TBD'}</b></div></div>{portfolio.correlatedClusters.length > 0 && <p className="correlation-warning">Correlation review: {portfolio.correlatedClusters.map((cluster) => cluster.name).join(', ')}.</p>}</section>;
}

function Overview({ trades, catalysts, policy, onCatalyst }: { trades: Trade[]; catalysts: Catalyst[]; policy?: AccountPolicy; onCatalyst: () => void }) {
  return <Page title="A clearer record of every decision." tag="Overview"><div className="hero-grid"><RiskPanel policy={policy} trades={trades} /><section className="panel journey"><span className="eyebrow">Decision journey</span><h2>{trades.length ? 'Research stays distinct from execution.' : 'Your workspace is ready.'}</h2><div className="pipeline">{['Research', 'Watchlist', 'Candidate', 'Confirmed', 'Active', 'Reviewed'].map((label, index) => <div className={trades.length && index === 1 ? 'current' : ''} key={label}><i>{index + 1}</i>{label}</div>)}</div></section></div><div className="two-col"><section className="panel"><span className="eyebrow">Catalyst-first path</span><h2>Start with the event.</h2><p>Record a scheduled catalyst, map direct and indirect securities, score evidence, then decide whether a defined-risk candidate is warranted.</p><button className="inline-action" onClick={onCatalyst}>Research a catalyst</button></section><section className="panel"><span className="eyebrow">Upcoming catalysts</span><h2>Next four events</h2><div className="catalyst-list">{catalysts.slice(0, 4).map((item) => <div key={item.id}><b>{item.date.slice(5)}</b><span>{item.event}<small>{item.ticker} · {item.sensitivity}</small></span></div>)}</div>{!catalysts.length && <p>No owner catalysts loaded.</p>}<a className="text-link" href="#/catalysts">Open Catalyst Radar →</a></section></div></Page>;
}

function Ideas({ trades, onNew }: { trades: Trade[]; onNew: () => void }) {
  return <Page title="Trade ideas" tag="Research pipeline" actions={<button className="inline-action" onClick={onNew}><Plus size={15} />New trade idea</button>}>{trades.length ? trades.map((trade) => <section className="panel trade-card" key={trade.id}><span className="eyebrow">{trade.entryStatus} · {trade.bias} · {trade.confidence}</span><h2>{trade.ticker} · {trade.strategy}</h2><p>Correlation cluster: {trade.correlationCluster || 'TBD'} · maximum loss: {money(trade.risk)}</p><div className="compare">{trade.candidates.map((candidate, index) => <article className={index ? 'candidate' : 'candidate featured'} key={candidate.name}><span className="eyebrow">{candidate.name}</span><h3>{candidate.width}</h3><p>{candidate.summary}</p><dl><div><dt>Net debit</dt><dd>{candidate.debit}</dd></div><div><dt>Defined risk</dt><dd>{candidate.risk}</dd></div></dl></article>)}</div></section>) : <section className="empty panel"><h2>No ideas on this device yet.</h2><p>Use New trade idea, then sign in to synchronize research privately across devices.</p><button className="inline-action" onClick={onNew}>Create a research draft</button></section>}</Page>;
}

function CatalystRadar({ catalysts, opportunities, onNew }: { catalysts: Catalyst[]; opportunities: Opportunity[]; onNew: () => void }) {
  const [tab, setTab] = useState<'calendar' | 'timeline' | 'opportunities'>('calendar');
  const [mode, setMode] = useState<'Month' | 'Week' | 'Day'>('Month');
  const [focus, setFocus] = useState(() => new Date());
  const eventMap = useMemo(() => catalysts.reduce<Map<string, Catalyst[]>>((map, item) => { map.set(item.date, [...(map.get(item.date) || []), item]); return map; }, new Map()), [catalysts]);
  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const weekStart = addDays(focus, -focus.getDay());
  const move = (direction: number) => setFocus((current) => mode === 'Month' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addDays(current, direction * (mode === 'Week' ? 7 : 1)));
  const title = mode === 'Month' ? focus.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : mode === 'Week' ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : focus.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const month = <div className="month-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <b key={`${label}-${index}`}>{label}</b>)}{Array.from({ length: 42 }, (_, index) => { const date = addDays(gridStart, index); const events = eventMap.get(dateKey(date)) || []; return <button className={`cal-day ${events.length ? 'has-event' : ''} ${date.getMonth() !== focus.getMonth() ? 'outside' : ''}`} key={dateKey(date)} onClick={() => { setFocus(date); setMode('Day'); }}><b>{date.getDate()}</b>{events.slice(0, 2).map((item) => <span className={category(item)} key={item.id}>{item.event}</span>)}{events.length > 2 && <small>+{events.length - 2} more</small>}</button>; })}</div>;
  const agendaDates = mode === 'Week' ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [focus];
  const agenda = <div className={`agenda ${mode.toLowerCase()}`}>{agendaDates.map((date) => <section className="agenda-day" key={dateKey(date)}><header><b>{date.toLocaleDateString(undefined, { weekday: 'short' })}</b><span>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></header>{(eventMap.get(dateKey(date)) || []).map((item) => <article className={category(item)} key={item.id}><b>{item.type || 'Catalyst'}</b><h3>{item.event}</h3><p>{item.ticker} · {item.sensitivity} sensitivity · {item.holdThrough}</p></article>)}{!(eventMap.get(dateKey(date)) || []).length && <p>No scheduled catalysts.</p>}</section>)}</div>;
  const eventName = (id: string) => catalysts.find((item) => item.id === id)?.event || 'Unlinked catalyst';
  return <Page title="Catalyst Radar" tag="Owner research events" actions={<button className="inline-action" onClick={onNew}><Plus size={15} />Research a catalyst</button>}><p className="calendar-intro">A scheduled-event workspace for catalyst mapping, research, trade candidates, and correlation-aware risk review. Calendar data remains owner-scoped.</p><div className="radar-tabs" role="tablist"><button className={tab === 'calendar' ? 'selected' : ''} onClick={() => setTab('calendar')}>Calendar</button><button className={tab === 'timeline' ? 'selected' : ''} onClick={() => setTab('timeline')}>Timeline</button><button className={tab === 'opportunities' ? 'selected' : ''} onClick={() => setTab('opportunities')}>Opportunities</button></div>{tab === 'calendar' && <><div className="calendar-toolbar"><div><button onClick={() => move(-1)} aria-label={`Previous ${mode.toLowerCase()}`}>‹</button><strong>{title}</strong><button onClick={() => move(1)} aria-label={`Next ${mode.toLowerCase()}`}>›</button><button onClick={() => setFocus(new Date())}>Today</button></div><div>{(['Month', 'Week', 'Day'] as const).map((view) => <button className={mode === view ? 'selected' : ''} onClick={() => setMode(view)} key={view}>{view}</button>)}</div></div><section className="calendar-shell panel">{mode === 'Month' ? month : agenda}</section><div className="legend"><span className="macro">Macro / jobs</span><span className="inflation">Inflation</span><span className="policy">Policy</span><span className="earn">Earnings</span></div></>}{tab === 'timeline' && <section className="panel timeline">{catalysts.length ? catalysts.slice().sort((a, b) => a.date.localeCompare(b.date)).map((item) => <article key={item.id} className={category(item)}><time>{item.date}</time><div><span className="eyebrow">{item.type} · {item.cluster || 'no cluster'}</span><h2>{item.event}</h2><p>{item.sensitivity} sensitivity · source: {item.source || 'TBD'} · {item.holdThrough}</p></div></article>) : <p>No owner events yet. Start a catalyst research draft to add the first scheduled event.</p>}</section>}{tab === 'opportunities' && <section className="opportunity-grid">{opportunities.length ? opportunities.map((item) => <article className="panel opportunity" key={item.id}><span className="eyebrow">{item.status} · {item.exposure}</span><h2>{item.ticker}</h2><p>{eventName(item.catalystId)}</p><dl><div><dt>Sensitivity</dt><dd>{item.sensitivity || 'TBD'}</dd></div><div><dt>Correlation</dt><dd>{item.cluster || 'TBD'}</dd></div></dl><p>{item.rationale || 'Mapping rationale is still needed.'}</p><small>Score status: {Object.keys(item.scores).length ? 'rationale recorded' : 'insufficient evidence'}</small></article>) : <section className="empty panel"><h2>No mapped opportunities yet.</h2><p>Use the catalyst-first draft to create a scheduled event and its first security mapping.</p></section>}</section>}</Page>;
}

function Research({ onNew }: { onNew: () => void }) { return <Page title="Research workflow" tag="Catalyst-first default"><section className="panel research-flow"><span className="eyebrow">Default sequence</span><h2>Event → mappings → evidence → score → vehicle → decision</h2><p>Start with a scheduled catalyst, map direct and indirect securities, state evidence and missing data, then compare a defined-risk vehicle against a no-trade outcome. Ticker-first research remains available.</p><button className="inline-action" onClick={onNew}>Start from a catalyst</button></section></Page>; }
function Empty({ title }: { title: string }) { return <Page title={title} tag="Journal workspace"><section className="empty panel"><h2>Ready when you are.</h2><p>Cloud drafts become canonical only after a private pull request is reviewed and manually merged.</p></section></Page>; }
function SettingsPage({ policy, onSavePolicy }: { policy?: AccountPolicy; onSavePolicy: (values: { total: number; capacity: number; strategies: string[]; effectiveDate: string }) => Promise<void> }) {
  const [form, setForm] = useState({ total: '', capacity: '', strategies: '', effectiveDate: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(policy ? { total: String(policy.total), capacity: String(policy.capacity), strategies: policy.strategies.join(', '), effectiveDate: policy.effectiveDate } : { total: '', capacity: '', strategies: '', effectiveDate: '' }); }, [policy]);
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const save = async () => {
    const total = Number(form.total);
    const capacity = Number(form.capacity);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(capacity) || capacity <= 0 || capacity > total) return setMessage('Enter positive capital and maximum-risk values, with risk no greater than capital.');
    setSaving(true);
    try {
      await onSavePolicy({ total, capacity, strategies: form.strategies.split(',').map((item) => item.trim()).filter(Boolean), effectiveDate: form.effectiveDate });
      setMessage('Owner policy saved to authenticated cloud storage.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Policy could not be saved.'); } finally { setSaving(false); }
  };
  return <Page title="Settings & privacy" tag="Owner controls"><div className="two-col"><section className="panel"><span className="eyebrow">Authenticated cloud</span><h2>{policy ? 'Owner policy loaded' : 'Set owner policy'}</h2><p>These values are blank until an approved owner enters them. They are stored behind owner-only RLS and are never embedded in the public build.</p><div className="policy-form"><label>Total account capital<input inputMode="decimal" value={form.total} onChange={(event) => update('total', event.target.value)} placeholder="Enter after sign-in" /></label><label>Maximum simultaneous defined risk<input inputMode="decimal" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} placeholder="Enter after sign-in" /></label><label>Preferred defined-risk strategies<input value={form.strategies} onChange={(event) => update('strategies', event.target.value)} placeholder="Comma separated" /></label><label>Effective date<input value={form.effectiveDate} onChange={(event) => update('effectiveDate', event.target.value)} placeholder="YYYY-MM-DD" /></label><button className="inline-action" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save owner policy'}</button>{message && <p>{message}</p>}</div></section><section className="panel"><span className="eyebrow">Public shell</span><h2>Empty by design</h2><p>GitHub Pages contains the application and empty/synthetic fixtures—no real thesis, calendar, account, journal, or payload data.</p></section></div><section className="panel"><span className="eyebrow">Private canonical journal</span><h2>Manual merge remains the final gate</h2><p>Submitting a revision opens a private OJ-Journal pull request. Automation and review do not replace your merge decision, and OJ never accesses brokerage credentials.</p></section></Page>;
}

function App() {
  const [route, setRoute] = useState<RoutePath>(currentHashPath);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [policy, setPolicy] = useState<AccountPolicy>();
  const [loading, setLoading] = useState(true);
  const [workflowMode, setWorkflowMode] = useState<ResearchMode | null>(null);
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

  const refresh = useCallback(async () => {
    if (demo) { setTrades(demoWorkspace.trades); setCatalysts(demoWorkspace.catalysts); setOpportunities(demoWorkspace.opportunities); setPolicy(demoWorkspace.policy); return; }
    if (!supabase) { setTrades([]); setCatalysts([]); setOpportunities([]); setPolicy(undefined); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTrades([]); setCatalysts([]); setOpportunities([]); setPolicy(undefined); return; }
    const [ideasResult, catalystResult, mappingResult, policyResult] = await Promise.all([
      supabase.from('trade_ideas').select('id,ticker,strategy,bias,confidence,sync_status,entry_status,correlation_cluster,data').is('deleted_at', null).order('updated_at', { ascending: false }),
      supabase.from('catalysts').select('id,event,event_type,event_at,catalyst_cluster_id,release_source,expected_sensitivity,data').is('deleted_at', null).order('event_at', { ascending: true }),
      supabase.from('catalyst_security_mappings').select('id,catalyst_id,ticker,exposure_type,sensitivity,research_status,correlation_cluster,rationale,opportunity_scores').is('deleted_at', null).order('updated_at', { ascending: false }),
      supabase.from('account_policies').select('total_account_capital,maximum_open_options_risk,preferred_defined_risk_strategies,effective_date').maybeSingle(),
    ]);
    const mappedTrades = (ideasResult.data || []).map((row) => {
      const data = (row.data || {}) as Record<string, unknown>;
      const submitted = Array.isArray(data.candidates) ? data.candidates as Array<Record<string, unknown>> : [];
      const fallback = [{ name: 'Balanced', width: 'Structure TBD', debit: String(data['Balanced candidate'] || 'TBD'), risk: String(data['Maximum loss'] || 'TBD'), summary: String(data['Balanced candidate'] || 'Complete candidate details in the private draft.') }, { name: 'Aggressive', width: 'Structure TBD', debit: String(data['Aggressive candidate'] || 'TBD'), risk: 'TBD', summary: String(data['Aggressive candidate'] || 'Complete candidate details in the private draft.') }];
      const candidates = submitted.length ? submitted.map((item, index) => ({ name: String(item.name || (index ? 'Aggressive' : 'Balanced')), width: String(item.width || 'Structure TBD'), debit: String(item.net_debit || item.debit || 'TBD'), risk: String(item.maximum_loss || item.risk || 'TBD'), summary: String(item.summary || 'Owner cloud candidate') })) : fallback;
      return { id: row.id, ticker: row.ticker, strategy: row.strategy, bias: row.bias, confidence: row.confidence || 'TBD', status: row.sync_status, entryStatus: row.entry_status || 'not-entered', correlationCluster: row.correlation_cluster || '', risk: numberFrom(data['Maximum loss'] || data['Calculated max loss']), candidates };
    });
    const mappedCatalysts = (catalystResult.data || []).filter((row) => row.event_at).map((row) => { const data = (row.data || {}) as Record<string, unknown>; return { id: row.id, date: String(row.event_at).slice(0, 10), event: row.event, sensitivity: String(row.expected_sensitivity || data.sensitivity || 'TBD'), holdThrough: Array.isArray(data.hold_through) && data.hold_through.length ? String(data.hold_through.join(', ')) : 'research only', ticker: 'Mapped securities', type: row.event_type, cluster: row.catalyst_cluster_id || '', source: row.release_source || String(data.scheduled_source || 'TBD') }; });
    const mappedOpportunities = (mappingResult.data || []).map((row) => ({ id: row.id, catalystId: row.catalyst_id, ticker: row.ticker, exposure: row.exposure_type, sensitivity: row.sensitivity || 'TBD', status: row.research_status, cluster: row.correlation_cluster || '', rationale: row.rationale || '', scores: (row.opportunity_scores || {}) as Record<string, unknown> }));
    const savedPolicy = policyResult.data ? { total: Number(policyResult.data.total_account_capital), capacity: Number(policyResult.data.maximum_open_options_risk), strategies: policyResult.data.preferred_defined_risk_strategies || [], effectiveDate: policyResult.data.effective_date || '' } : undefined;
    setTrades(mappedTrades); setCatalysts(mappedCatalysts); setOpportunities(mappedOpportunities); setPolicy(savedPolicy);
  }, [demo]);

  const saveOwnerPolicy = useCallback(async (values: { total: number; capacity: number; strategies: string[]; effectiveDate: string }) => {
    if (!supabase) throw new Error('Cloud is not configured on this device.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in with an approved owner account before saving a policy.');
    const { error } = await supabase.from('account_policies').upsert({ user_id: user.id, total_account_capital: values.total, maximum_open_options_risk: values.capacity, preferred_defined_risk_strategies: values.strategies, effective_date: values.effectiveDate || new Date().toISOString().slice(0, 10) }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh]);

  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 450); void refresh(); const auth = supabase?.auth.onAuthStateChange(() => void refresh()); const update = () => void refresh(); window.addEventListener('oj-cloud-workspace-updated', update); return () => { clearTimeout(timer); auth?.data.subscription.unsubscribe(); window.removeEventListener('oj-cloud-workspace-updated', update); }; }, [refresh]);
  useEffect(() => { const updateRoute = () => setRoute(currentHashPath()); window.addEventListener('hashchange', updateRoute); return () => window.removeEventListener('hashchange', updateRoute); }, []);
  if (loading) return <div className="loading"><div className="juice"><img src={`${import.meta.env.BASE_URL}brand/oj-logo-mark-white.svg`} alt="OJ" /><i /><b /><b /></div><span>Preparing your journal…</span></div>;
  const portfolio = portfolioRisk(trades.map((trade) => ({ maxLoss: trade.risk, correlationCluster: trade.correlationCluster, isOpen: trade.entryStatus === 'active' })), policy?.capacity);
  const openTicker = () => setWorkflowMode('ticker');
  const openCatalyst = () => setWorkflowMode('catalyst');
  const content = route === '/' ? <Overview trades={trades} catalysts={catalysts} policy={policy} onCatalyst={openCatalyst} /> : route === '/trade-ideas' ? <Ideas trades={trades} onNew={openTicker} /> : route === '/catalysts' ? <CatalystRadar catalysts={catalysts} opportunities={opportunities} onNew={openCatalyst} /> : route === '/research' ? <Research onNew={openCatalyst} /> : route === '/settings' ? <SettingsPage policy={policy} onSavePolicy={saveOwnerPolicy} /> : <Empty title={navigation.find((item) => item[0] === route)?.[1] || ''} />;
  return <><Shell current={route} onIdea={openTicker}>{content}</Shell><Workflow open={workflowMode !== null} onClose={() => setWorkflowMode(null)} initialMode={workflowMode || 'ticker'} catalysts={catalysts.map(({ id, event, date }) => ({ id, event, date }))} capacity={policy?.capacity} openRisk={portfolio.totalRisk} /></>;
}

export default App;
