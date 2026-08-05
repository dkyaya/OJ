import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, CalendarDays, ClipboardCheck, Lightbulb, Menu, Plus, Settings, ShieldCheck, Target, X } from 'lucide-react';
import { Workflow } from './components/Workflow';
import { supabase } from './lib/supabase';

type Candidate = { name: string; width: string; debit: string; risk: string; summary: string };
type Trade = { id: string; ticker: string; strategy: string; bias: string; confidence: string; status: string; candidates: Candidate[] };
type Catalyst = { id: string; date: string; event: string; sensitivity: string; holdThrough: string; ticker: string; type: string };
const navigation = [
  ['/', 'Overview', Activity], ['/trade-ideas', 'Trade ideas', Lightbulb], ['/active-trades', 'Active', Target],
  ['/closed-trades', 'Closed', ClipboardCheck], ['/research', 'Research', BookOpen], ['/catalysts', 'Calendar', CalendarDays],
  ['/analytics', 'Analytics', BarChart3], ['/journal', 'Journal', BookOpen], ['/settings', 'Settings', Settings],
] as const;
type RoutePath = typeof navigation[number][0];

const currentHashPath = (): RoutePath => {
  const requested = window.location.hash.slice(1) || '/';
  return navigation.some(([path]) => path === requested) ? requested as RoutePath : '/';
};

function NavItem({ to, current, children, className = '', onClick }: { to: RoutePath; current: RoutePath; children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <a className={`${className} ${current === to ? 'active' : ''}`.trim()} href={`#${to}`} onClick={onClick}>{children}</a>;
}

const Page = ({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) => (
  <section className="page"><div className="page-heading"><div><span className="eyebrow">{tag}</span><h1>{title}</h1></div></div>{children}</section>
);

function MobileMenu({ onIdea, current }: { onIdea: () => void; current: RoutePath }) {
  const [open, setOpen] = useState(false);
  return <div className="mobile-menu">
    <button className="menu-trigger" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    {open && <div className="menu-sheet"><button className="mobile-idea" onClick={() => { onIdea(); setOpen(false); }}><Plus />New trade idea</button>
      {navigation.map(([to, label, Icon]) => <NavItem key={to} to={to} current={current} onClick={() => setOpen(false)}><Icon size={18} />{label}</NavItem>)}
    </div>}
  </div>;
}

function Shell({ children, current }: { children: React.ReactNode; current: RoutePath }) {
  const [dark, setDark] = useState(true);
  const [workflow, setWorkflow] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  return <div className="shell">
    <aside className="sidebar"><img className="logo" src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" />
      <nav>{navigation.map(([to, label, Icon]) => <NavItem key={to} to={to} current={current}><Icon size={18} />{label}</NavItem>)}</nav>
      <button className="new-trade" onClick={() => setWorkflow(true)}><Plus size={16} />New trade idea</button>
      <div className="privacy"><ShieldCheck size={17} />Research only<br />No brokerage access</div>
    </aside>
    <main><header className="topbar"><div><span className="eyebrow">Private decision journal</span><strong>Options Journey</strong></div><div className="top-actions"><button className="theme" onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button></div></header>{children}</main>
    <MobileMenu current={current} onIdea={() => setWorkflow(true)} /><Workflow open={workflow} onClose={() => setWorkflow(false)} />
  </div>;
}

function Overview({ trade, catalysts }: { trade?: Trade; catalysts: Catalyst[] }) {
  return <Page title="A clearer record of every decision." tag="Overview">
    <div className="hero-grid"><section className="hero panel"><div><span className="eyebrow">Private capital context</span><h2>Sign in <small>to view account metrics</small></h2><p>Exact balances and private performance remain in authenticated cloud records, never the public build.</p></div><div className="risk"><div className="ring"><div><b>—</b><span>private</span></div></div><p>owner-only view</p></div><div className="metrics"><div><span>Options allocation</span><b>Private</b></div><div><span>Available</span><b>Private</b></div><div><span>Realized P&amp;L</span><b>Private</b></div><div><span>Unrealized P&amp;L</span><b>Private</b></div></div></section>
      <section className="panel journey"><span className="eyebrow">Journey progress</span><h2>{trade ? 'One idea, properly documented.' : 'Your workspace is ready.'}</h2><div className="pipeline">{['Research','Watchlist','Ready','Active','Closed','Reviewed'].map((label,index) => <div className={trade && index === 1 ? 'current' : ''} key={label}><i>{index + 1}</i>{label}</div>)}</div></section></div>
    <div className="two-col"><section className="panel"><span className="eyebrow">Owner cloud workspace</span>{trade ? <><h2>{trade.ticker} · {trade.strategy}</h2><p>{trade.status} · {trade.bias} · {trade.confidence}. Canonical notes remain in the private journal repository.</p></> : <><h2>No owner records loaded</h2><p>Sign in or create a draft. The public Pages artifact contains only this empty application shell.</p></>}</section>
      <section className="panel"><span className="eyebrow">Upcoming catalysts</span><h2>Next four events</h2><div className="catalyst-list">{catalysts.slice(0,4).map((item) => <div key={item.id}><b>{item.date.slice(5)}</b><span>{item.event}<small>{item.ticker} · {item.sensitivity}</small></span></div>)}</div>{!catalysts.length && <p>No owner catalysts loaded.</p>}<a className="text-link" href="#/catalysts">Open calendar →</a></section></div>
  </Page>;
}

function Ideas({ trades }: { trades: Trade[] }) {
  return <Page title="Trade ideas" tag="Research pipeline">{trades.length ? trades.map((trade) => <section className="panel trade-card" key={trade.id}><span className="eyebrow">{trade.bias} · {trade.confidence}</span><h2>{trade.ticker} · {trade.strategy}</h2><div className="compare">{trade.candidates.map((candidate,index) => <article className={index ? 'candidate' : 'candidate featured'} key={candidate.name}><span className="eyebrow">{candidate.name}</span><h3>{candidate.width}</h3><p>{candidate.summary}</p><dl><div><dt>Target debit</dt><dd>{candidate.debit}</dd></div><div><dt>Risk</dt><dd>{candidate.risk}</dd></div></dl></article>)}</div></section>) : <section className="empty panel"><h2>No ideas on this device yet.</h2><p>Use New trade idea, then sign in to synchronize it privately across devices.</p></section>}</Page>;
}

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const category = (item: Catalyst) => item.type === 'earnings' || /earnings/i.test(item.event) ? 'earn' : item.type === 'inflation' || /CPI|PPI|inflation/i.test(item.event) ? 'inflation' : 'macro';
function Calendar({ catalysts }: { catalysts: Catalyst[] }) {
  const [mode, setMode] = useState<'Month'|'Week'|'Day'>('Month');
  const [focus, setFocus] = useState(() => new Date());
  const eventMap = useMemo(() => new Map(catalysts.map((item) => [item.date, [...(catalysts.filter((other) => other.date === item.date))]])), [catalysts]);
  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const weekStart = addDays(focus, -focus.getDay());
  const move = (direction: number) => setFocus((current) => mode === 'Month' ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addDays(current, direction * (mode === 'Week' ? 7 : 1)));
  const title = mode === 'Month' ? focus.toLocaleDateString(undefined,{month:'long',year:'numeric'}) : mode === 'Week' ? `${weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${addDays(weekStart,6).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}` : focus.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const month = <div className="month-grid">{['S','M','T','W','T','F','S'].map((label,index) => <b key={index}>{label}</b>)}{Array.from({length:42},(_,index) => { const date=addDays(gridStart,index); const events=eventMap.get(dateKey(date)) || []; return <button className={`cal-day ${events.length ? 'has-event' : ''} ${date.getMonth() !== focus.getMonth() ? 'outside' : ''}`} key={dateKey(date)} onClick={() => { setFocus(date); setMode('Day'); }}><b>{date.getDate()}</b>{events.slice(0,3).map((item) => <span className={category(item)} key={item.id}>{item.event}</span>)}{events.length > 3 && <small>+{events.length - 3} more</small>}</button>; })}</div>;
  const agendaDates = mode === 'Week' ? Array.from({length:7},(_,index) => addDays(weekStart,index)) : [focus];
  const agenda = <div className={`agenda ${mode.toLowerCase()}`}>{agendaDates.map((date) => <section className="agenda-day" key={dateKey(date)}><header><b>{date.toLocaleDateString(undefined,{weekday:'short'})}</b><span>{date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></header>{(eventMap.get(dateKey(date)) || []).map((item) => <article className={category(item)} key={item.id}><b>{item.type || 'Catalyst'}</b><h3>{item.event}</h3><p>{item.ticker} · {item.sensitivity} sensitivity · {item.holdThrough}</p></article>)}{!(eventMap.get(dateKey(date)) || []).length && <p>No scheduled catalysts.</p>}</section>)}</div>;
  return <Page title="Catalyst calendar" tag="All owner research events"><div className="calendar-toolbar"><div><button onClick={() => move(-1)} aria-label={`Previous ${mode.toLowerCase()}`}>‹</button><strong>{title}</strong><button onClick={() => move(1)} aria-label={`Next ${mode.toLowerCase()}`}>›</button><button onClick={() => setFocus(new Date())}>Today</button></div><div>{(['Month','Week','Day'] as const).map((view) => <button className={mode === view ? 'selected' : ''} onClick={() => setMode(view)} key={view}>{view}</button>)}</div></div><section className="calendar-shell panel">{mode === 'Month' ? month : agenda}</section><div className="legend"><span className="macro">Macro / jobs</span><span className="inflation">Inflation</span><span className="earn">Earnings</span></div></Page>;
}

function Empty({ title }: { title: string }) { return <Page title={title} tag="Journal workspace"><section className="empty panel"><h2>Ready when you are.</h2><p>Cloud drafts become canonical only after a private pull request is reviewed and manually merged.</p></section></Page>; }
function SettingsPage() { return <Page title="Settings & privacy" tag="Owner controls"><div className="two-col"><section className="panel"><span className="eyebrow">Public shell</span><h2>Empty by design</h2><p>GitHub Pages contains the application, branding, and empty demo fixtures—no real thesis, calendar, account, journal, or payload data.</p></section><section className="panel"><span className="eyebrow">Authenticated cloud</span><h2>Your approved account only</h2><p>Private drafts and normalized published records load after sign-in under owner-only RLS. OJ stores no brokerage credentials and cannot execute trades.</p></section></div><section className="panel"><span className="eyebrow">Private canonical journal</span><h2>Manual merge remains the final gate</h2><p>Submit freezes a revision and opens a private PR in OJ-Journal. Automatic checks and Codex review do not replace your merge decision.</p></section></Page>; }

function App() {
  const [route, setRoute] = useState<RoutePath>(currentHashPath);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [catalysts, setCatalysts] = useState<Catalyst[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!supabase) { setTrades([]); setCatalysts([]); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTrades([]); setCatalysts([]); return; }
    const [ideasResult, catalystResult] = await Promise.all([
      supabase.from('trade_ideas').select('id,ticker,strategy,bias,confidence,sync_status,data').is('deleted_at',null).order('updated_at',{ascending:false}),
      supabase.from('catalysts').select('id,event,event_type,event_at,data,trade_ideas(ticker)').is('deleted_at',null).order('event_at',{ascending:true}),
    ]);
    const mappedTrades = (ideasResult.data || []).map((row) => {
      const data = (row.data || {}) as Record<string, unknown>;
      const submitted = Array.isArray(data.candidates) ? data.candidates as Array<Record<string,unknown>> : [];
      const fallback = [
        { name:'Balanced', width:'Structure TBD', debit:String(data['Balanced candidate'] || 'TBD'), risk:'TBD', summary:String(data['Balanced candidate'] || 'Complete candidate details in the private draft.') },
        { name:'Aggressive', width:'Structure TBD', debit:String(data['Aggressive candidate'] || 'TBD'), risk:'TBD', summary:String(data['Aggressive candidate'] || 'Complete candidate details in the private draft.') },
      ];
      const candidates = submitted.length ? submitted.map((item,index) => ({ name:String(item.name || (index ? 'Aggressive' : 'Balanced')), width:String(item.width || 'Structure TBD'), debit:String(item.net_debit || item.debit || 'TBD'), risk:String(item.maximum_loss || item.risk || 'TBD'), summary:String(item.summary || 'Owner cloud candidate') })) : fallback;
      return { id:row.id,ticker:row.ticker,strategy:row.strategy,bias:row.bias,confidence:row.confidence || 'TBD',status:row.sync_status,candidates };
    });
    const mappedCatalysts = (catalystResult.data || []).filter((row) => row.event_at).map((row) => ({ id:row.id,date:String(row.event_at).slice(0,10),event:row.event,sensitivity:String((row.data as Record<string,unknown>)?.sensitivity || 'TBD'),holdThrough:String((row.data as Record<string,unknown>)?.hold_through || 'research only'),ticker:String((row.trade_ideas as unknown as {ticker?:string} | null)?.ticker || 'Market'),type:row.event_type }));
    setTrades(mappedTrades); setCatalysts(mappedCatalysts);
  }, []);
  useEffect(() => { const timer=window.setTimeout(() => setLoading(false),900); void refresh(); const auth=supabase?.auth.onAuthStateChange(() => void refresh()); const update=() => void refresh(); window.addEventListener('oj-cloud-workspace-updated',update); return () => { clearTimeout(timer); auth?.data.subscription.unsubscribe(); window.removeEventListener('oj-cloud-workspace-updated',update); }; }, [refresh]);
  useEffect(() => { const updateRoute = () => setRoute(currentHashPath()); window.addEventListener('hashchange', updateRoute); return () => window.removeEventListener('hashchange', updateRoute); }, []);
  if (loading) return <div className="loading"><div className="juice"><img src={`${import.meta.env.BASE_URL}brand/oj-logo-mark-white.svg`} alt="OJ" /><i /><b /><b /></div><span>Preparing your journal…</span></div>;
  const content = route === '/' ? <Overview trade={trades[0]} catalysts={catalysts} />
    : route === '/trade-ideas' ? <Ideas trades={trades} />
    : route === '/catalysts' ? <Calendar catalysts={catalysts} />
    : route === '/settings' ? <SettingsPage />
    : <Empty title={navigation.find((item) => item[0] === route)?.[1] || ''} />;
  return <Shell current={route}>{content}</Shell>;
}
export default App;
