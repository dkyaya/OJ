import { BarChart3, CalendarDays, LayoutDashboard, Lightbulb, NotebookPen, TrendingUp, type LucideIcon } from 'lucide-react';

export type PrimaryPath = '/' | '/catalysts' | '/ideas' | '/trades' | '/journal' | '/insights';
export type AppPath = PrimaryPath | '/workspace' | '/settings';

export type NavItem = {
  path: PrimaryPath;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

export const primaryNavigation: NavItem[] = [
  { path: '/', label: 'Overview', subtitle: 'Risk, trades, and upcoming events.', icon: LayoutDashboard },
  { path: '/catalysts', label: 'Catalysts', subtitle: 'Scheduled events and market impact.', icon: CalendarDays },
  { path: '/ideas', label: 'Ideas', subtitle: 'Research and compare trade setups.', icon: Lightbulb },
  { path: '/trades', label: 'Trades', subtitle: 'Track positions and execution.', icon: TrendingUp },
  { path: '/journal', label: 'Journal', subtitle: 'Review decisions and outcomes.', icon: NotebookPen },
  { path: '/insights', label: 'Insights', subtitle: 'Patterns across your trading history.', icon: BarChart3 },
];

export const legacyRoutes: Record<string, AppPath> = {
  '/trade-ideas': '/ideas',
  '/research': '/ideas',
  '/active-trades': '/trades',
  '/closed-trades': '/trades',
  '/analytics': '/insights',
};

export function normalizePath(hash = window.location.hash): { path: AppPath; legacy?: string } {
  const raw = (hash.replace(/^#/, '').split('?')[0] || '/').replace(/\/$/, '') || '/';
  if (legacyRoutes[raw]) return { path: legacyRoutes[raw], legacy: raw };
  if (raw === '/settings' || raw === '/workspace') return { path: raw };
  const primary = primaryNavigation.find((item) => item.path === raw);
  return { path: primary?.path || '/' };
}

export function navigate(path: AppPath) {
  window.location.hash = path;
}
