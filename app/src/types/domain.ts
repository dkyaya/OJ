export type IdeaStatus = 'draft' | 'watchlist' | 'ready' | 'deferred' | 'rejected' | 'invalidated';

export type Candidate = {
  id: string;
  name: string;
  longStrike?: number;
  shortStrike?: number;
  debit?: number;
  contracts?: number;
  maxLoss?: number;
  maxProfit?: number;
  breakEven?: number;
  notes?: string;
};

export type TradeIdea = {
  id: string;
  ticker: string;
  strategy: string;
  bias: string;
  status: IdeaStatus;
  confidence?: string;
  thesis?: string;
  entryConditions?: string;
  invalidation?: string;
  plannedExit?: string;
  catalystId?: string;
  catalystCluster?: string;
  risk?: number;
  archivedAt?: string;
  updatedAt: string;
  revision: number;
  candidates: Candidate[];
  data: Record<string, unknown>;
};

export type Catalyst = {
  id: string;
  event: string;
  type: string;
  date?: string;
  sensitivity?: string;
  status: string;
  source?: string;
  cluster?: string;
  linkedTickers: string[];
  revision: number;
  data: Record<string, unknown>;
};

export type Position = {
  id: string;
  ideaId: string;
  ticker: string;
  strategy: string;
  status: 'active' | 'closed';
  contracts: number;
  maxRisk?: number;
  openedAt: string;
  closedAt?: string;
  revision: number;
  data: Record<string, unknown>;
};

export type JournalRecord = {
  id: string;
  ideaId: string;
  kind: 'check-in' | 'review';
  createdAt: string;
  summary: string;
  data: Record<string, unknown>;
};

export type Opportunity = {
  id: string;
  catalystId: string;
  ideaId?: string;
  ticker: string;
  exposure: string;
  sensitivity?: string;
  rationale?: string;
  scores: Record<string, unknown>;
};

export type AccountPolicy = {
  totalCapital: number;
  maximumOpenRisk: number;
  fixedPerTradeLimit?: number;
  strategies: string[];
  effectiveDate: string;
  version: number;
};

export type AppPreferences = {
  theme: 'system' | 'light' | 'dark';
  calendarView: 'month' | 'week' | 'day';
  compactCards: boolean;
  revision: number;
};

export type AccountProfile = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  role: 'owner' | 'member';
  status: 'pending' | 'invited' | 'active' | 'disabled';
};

export type Workspace = {
  authenticated: boolean;
  approved: boolean;
  demo: boolean;
  ideas: TradeIdea[];
  archivedIdeas: TradeIdea[];
  catalysts: Catalyst[];
  positions: Position[];
  journal: JournalRecord[];
  opportunities: Opportunity[];
  profile?: AccountProfile;
  policy?: AccountPolicy;
  preferences?: AppPreferences;
  pendingReviews: number;
  lastLoadedAt: string;
};
