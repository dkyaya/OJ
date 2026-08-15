import type { AppPath } from '../../config/navigation';

export const PRODUCT_TOUR_VERSION = 1;

export type ProductTourStatus = 'not_started' | 'in_progress' | 'skipped' | 'completed';

export type ProductTourState = {
  version: number;
  status: ProductTourStatus;
  step: number;
  updatedAt?: string;
};

export type ProductTourStep = {
  id: string;
  route: AppPath;
  target: string;
  eyebrow: string;
  title: string;
  body: string;
};

export const productTourSteps: ProductTourStep[] = [
  {
    id: 'welcome', route: '/', target: 'overview-shell', eyebrow: 'Welcome to OJ', title: 'A deliberate research workflow',
    body: 'OJ moves from scheduled facts to a private Idea, a planned Candidate, an actual Trade, monitoring, and reflection. The app never connects to or trades through a brokerage.',
  },
  {
    id: 'risk', route: '/', target: 'overview-risk', eyebrow: 'Overview', title: 'Know the risk you chose',
    body: 'This summary applies your OJ risk policy to confirmed open Trades. Remaining capacity is a research guardrail—not cash, margin, or brokerage buying power.',
  },
  {
    id: 'catalysts', route: '/catalysts', target: 'catalyst-calendar', eyebrow: 'Catalysts', title: 'Start with scheduled facts',
    body: 'Use the calendar to see upcoming events before choosing a ticker. Dates, sources, sensitivity, and affected securities belong to the shared factual layer.',
  },
  {
    id: 'war-room', route: '/catalysts', target: 'catalyst-war-room', eyebrow: 'Catalyst War Room', title: 'Organize research without forcing a Trade',
    body: 'A War Room brings together factual evidence, missions, forecasts, and Catalyst Intelligence. This tour does not fetch provider data, consume API credits, or create records.',
  },
  {
    id: 'ideas', route: '/ideas', target: 'ideas-shell', eyebrow: 'Ideas', title: 'Keep conclusions private',
    body: 'Ideas hold your thesis, conditions, invalidation, and planned exit. Workspace members may share facts while each person keeps conclusions, sizing, and Trade decisions private.',
  },
  {
    id: 'candidates', route: '/ideas', target: 'idea-candidates', eyebrow: 'Candidate', title: 'Plan a defined-risk structure',
    body: 'A Candidate is a possible spread, not an order and not a fill. Compare its planned debit, strikes, and maximum loss before deciding whether to trade elsewhere.',
  },
  {
    id: 'record-trade', route: '/trades', target: 'record-trade-action', eyebrow: 'Record Trade', title: 'Separate planning from execution',
    body: 'After a real fill occurs outside OJ, record the actual execution manually. OJ preserves planned-versus-actual values but never previews, routes, or submits an order.',
  },
  {
    id: 'monitoring', route: '/trades', target: 'trade-monitoring', eyebrow: 'Trade monitoring', title: 'Keep Check-Ins with the Trade',
    body: 'Check-Ins capture changes in thesis health and management view. They remain in the Trade history and inform a later debrief; they do not appear as Journal entries.',
  },
  {
    id: 'journal', route: '/journal', target: 'journal-debriefs', eyebrow: 'Journal', title: 'Reflect without rewriting history',
    body: 'Journal is for Trade debriefs and personal lessons. Original entry context, Check-Ins, and outcome facts stay linked so reflection does not overwrite the historical record.',
  },
  {
    id: 'insights', route: '/insights', target: 'insights-shell', eyebrow: 'Insights', title: 'Look for patterns carefully',
    body: 'Insights summarizes confirmed history, completed reviews, and calibrated forecasts. Small samples stay labeled so a few outcomes are not mistaken for a durable edge.',
  },
  {
    id: 'finish', route: '/settings', target: 'tour-guidance', eyebrow: 'You are ready', title: 'Return whenever you need a refresher',
    body: 'The full workflow is now yours to explore. Replay or resume this tour from Guidance in Settings at any time.',
  },
];

const defaultState = (): ProductTourState => ({ version: PRODUCT_TOUR_VERSION, status: 'not_started', step: 0 });

export function readProductTourState(data: unknown): ProductTourState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return defaultState();
  const raw = (data as Record<string, unknown>).productTour;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultState();
  const value = raw as Record<string, unknown>;
  if (value.version !== PRODUCT_TOUR_VERSION) return defaultState();
  const status = typeof value.status === 'string' && ['not_started','in_progress','skipped','completed'].includes(value.status)
    ? value.status as ProductTourStatus
    : 'not_started';
  const rawStep = typeof value.step === 'number' && Number.isFinite(value.step) ? Math.floor(value.step) : 0;
  return {
    version: PRODUCT_TOUR_VERSION,
    status,
    step: Math.max(0, Math.min(productTourSteps.length - 1, rawStep)),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

export function createProductTourState(status: ProductTourStatus, step = 0, now = new Date()): ProductTourState {
  return {
    version: PRODUCT_TOUR_VERSION,
    status,
    step: Math.max(0, Math.min(productTourSteps.length - 1, Math.floor(step))),
    updatedAt: now.toISOString(),
  };
}

export function productTourPreferenceData(data: Record<string, unknown> | undefined, state: ProductTourState) {
  return { ...(data || {}), productTour: state };
}

export function productTourActionLabel(state: ProductTourState) {
  return state.status === 'in_progress' ? 'Resume Product Tour' : 'Take Product Tour';
}
