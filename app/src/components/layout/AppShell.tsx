import { useState, type PropsWithChildren } from 'react';
import { Menu, Moon, Plus, Settings, Sun, X } from 'lucide-react';
import { navigate, primaryNavigation, type AppPath } from '../../config/navigation';
import { CloudAccount } from '../CloudAccount';

function NavLink({ path, current, compact = false, onClick }: { path: typeof primaryNavigation[number]['path']; current: AppPath; compact?: boolean; onClick?: () => void }) {
  const item = primaryNavigation.find((candidate) => candidate.path === path)!; const Icon = item.icon;
  return <a href={`#${item.path}`} className={current === item.path ? 'active' : ''} aria-current={current === item.path ? 'page' : undefined} onClick={onClick}><Icon size={compact ? 20 : 18} /><span>{item.label}</span></a>;
}

export function AppShell({ current, dark, userId, email, onTheme, onBuildIdea, onRefresh, children }: PropsWithChildren<{ current: AppPath; dark: boolean; userId?: string; email?: string; onTheme: () => void; onBuildIdea: () => void; onRefresh: () => void }>) {
  const [more, setMore] = useState(false);
  const mobilePrimary = primaryNavigation.slice(0, 4);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><img src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" /><nav aria-label="Primary">{primaryNavigation.map((item) => <NavLink key={item.path} path={item.path} current={current} />)}</nav><button className="build-button" onClick={onBuildIdea}><Plus size={17} />Build Idea</button><div className="sidebar-note"><b>Private research</b><span>No brokerage access</span></div></aside>
    <main id="main-content"><header className="topbar"><div><span className="eyebrow">Options Journey</span><strong>{primaryNavigation.find((item) => item.path === current)?.label || (current === '/settings' ? 'Settings' : 'Overview')}</strong></div><div className="top-actions">{userId && email && <CloudAccount userId={userId} email={email} onRefresh={onRefresh} />}<button className="icon-button" onClick={onTheme} aria-label={dark ? 'Use light mode' : 'Use dark mode'}>{dark ? <Sun /> : <Moon />}</button><button className="icon-button" onClick={() => navigate('/settings')} aria-label="Open settings"><Settings /></button></div></header>{children}</main>
    <nav className="mobile-nav" aria-label="Mobile primary">{mobilePrimary.map((item) => <NavLink key={item.path} path={item.path} current={current} compact />)}<button className={more ? 'active' : ''} onClick={() => setMore(!more)} aria-expanded={more} aria-label={more ? 'Close more navigation' : 'Open more navigation'}>{more ? <X /> : <Menu />}<span>More</span></button></nav>
    {more && <div className="more-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMore(false); }}><section className="more-sheet" role="dialog" aria-label="More navigation"><header><b>More</b><button className="icon-button" onClick={() => setMore(false)} aria-label="Close more navigation"><X /></button></header><nav>{primaryNavigation.slice(4).map((item) => <NavLink key={item.path} path={item.path} current={current} onClick={() => setMore(false)} />)}<a href="#/settings" className={current === '/settings' ? 'active' : ''} onClick={() => setMore(false)}><Settings size={18} /><span>Settings</span></a></nav><button className="build-button" onClick={() => { setMore(false); onBuildIdea(); }}><Plus size={17} />Build Idea</button></section></div>}
  </div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}
