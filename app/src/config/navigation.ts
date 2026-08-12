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

export function catalystIdFromHash(hash = typeof window === 'undefined' ? '' : window.location.hash) {
  const query = hash.replace(/^#/, '').split('?')[1] || '';
  const catalystId = new URLSearchParams(query).get('catalyst')?.trim() || '';
  return /^[a-z0-9-]{1,100}$/i.test(catalystId) ? catalystId : '';
}

export function catalystHash(catalystId: string) {
  return `#/catalysts?catalyst=${encodeURIComponent(catalystId)}`;
}

export function navigateToCatalyst(catalystId: string) {
  window.location.hash = catalystHash(catalystId).replace(/^#/, '');
}
