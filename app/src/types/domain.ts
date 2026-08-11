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
  eventAt?: string;
  sensitivity?: string;
  status: string;
  source?: string;
  cluster?: string;
  linkedTickers: string[];
  revision: number;
  data: Record<string, unknown>;
  ownerId?: string;
  workspaceId?: string;
  createdBy?: string;
  updatedBy?: string;
  visibility: 'private' | 'workspace';
};

export type ResearchWorkspace = { id: string; name: string; createdBy: string; updatedAt: string };
export type WorkspaceMember = { workspaceId: string; userId: string; displayName: string; initials: string; workspaceRole: 'owner' | 'member'; membershipStatus: 'active' | 'left' | 'removed'; joinedAt: string };
export type PendingWorkspaceInvite = { id: string; workspaceId: string; workspaceName: string; invitedByName: string; expiresAt: string };
export type EvidenceType = 'supports_bull' | 'supports_bear' | 'neutral' | 'needs_verification';
export type EvidenceCard = { id: string; workspaceId: string; catalystId: string; missionId?: string; authorId: string; evidenceType: EvidenceType; title: string; summary: string; sourceLabel?: string; sourceUrl?: string; observedAt?: string; confidence?: number; affectedAssumption?: string; verificationStatus: 'unverified' | 'verified' | 'needs_review'; lastVerifiedAt?: string; createdAt: string; updatedAt: string };
export type EvidenceResponse = { id: string; evidenceId: string; workspaceId: string; authorId: string; responseType: 'comment' | 'confirm' | 'challenge' | 'counter_source'; body: string; sourceUrl?: string; createdAt: string };
export type SharedThesis = { id: string; workspaceId: string; authorId: string; catalystId?: string; ticker: string; strategy: string; bias: string; thesisSummary: string; expectedMoveSummary?: string; confidence?: number; createdAt: string; updatedAt: string };
export type SharedThesisResponse = { id: string; sharedThesisId: string; workspaceId: string; authorId: string; responseType: 'comment' | 'question' | 'challenge'; body: string; createdAt: string };
export type ActivityEvent = { id: string; workspaceId: string; actorId: string; eventType: string; objectType: string; objectId?: string; summary: string; createdAt: string };
export type ResearchMission = { id: string; workspaceId: string; catalystId: string; title: string; status: 'draft' | 'active' | 'completed' | 'archived'; completedDecision?: 'trade' | 'watch' | 'no_trade'; createdBy: string; createdAt: string; updatedAt: string; completedAt?: string };
export type MissionAssignment = { id: string; missionId: string; workspaceId: string; assigneeId?: string; createdBy: string; role?: 'macro_scout' | 'market_mapper' | 'options_mechanic' | 'risk_officer' | 'devils_advocate'; task: string; status: 'open' | 'completed'; completedAt?: string };
export type ResearchQuestion = { id: string; missionId: string; workspaceId: string; createdBy: string; assignedTo?: string; question: string; resolution?: string; status: 'open' | 'resolved'; createdAt: string };
export type LiquidityObservation = { id: string; missionId: string; workspaceId: string; createdBy: string; ticker: string; observation: string; sourceLabel?: string; observedAt: string; lastVerifiedAt?: string; createdAt: string };
export type MissionCheckpoint = { missionId: string; workspaceId: string; checkpointType: string; status: 'pending' | 'completed'; completedBy?: string; completedAt?: string; note?: string };
export type PersonalForecast = { id: string; userId: string; workspaceId: string; catalystId: string; missionId?: string; expectedResult: string; marketDirection: 'bullish' | 'bearish' | 'neutral' | 'mixed'; expectedMagnitude?: number; magnitudeUnit: 'percent' | 'points' | 'qualitative'; confidence: number; preferredTicker?: string; intendedStrategy?: string; tradeDecision: 'trade' | 'watch' | 'no_trade' | 'undecided'; visibility: 'private' | 'workspace'; revision: number; lockedAt?: string; createdAt: string; updatedAt: string };
export type ForecastRevision = { id: string; forecastId: string; userId: string; workspaceId: string; revision: number; snapshotType: 'draft' | 'locked'; visibility: 'private' | 'workspace'; snapshot: Record<string, unknown>; revisionReason?: string; createdAt: string; lockedAt?: string };
export type MissionDebrief = { id: string; workspaceId: string; missionId: string; catalystId: string; authorId: string; actualResult: string; actualDirection?: 'bullish' | 'bearish' | 'neutral' | 'mixed'; actualMagnitude?: number; marketReaction: string; keyDriver?: string; whatWorked?: string; whatMissed?: string; unexpectedFactor?: string; sharedSummary?: string; visibility: 'private' | 'workspace'; createdAt: string; updatedAt: string };

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
  researchWorkspace?: ResearchWorkspace;
  workspaceMembers: WorkspaceMember[];
  pendingWorkspaceInvites: PendingWorkspaceInvite[];
  evidence: EvidenceCard[];
  evidenceResponses: EvidenceResponse[];
  sharedTheses: SharedThesis[];
  sharedThesisResponses: SharedThesisResponse[];
  activity: ActivityEvent[];
  missions: ResearchMission[];
  missionAssignments: MissionAssignment[];
  researchQuestions: ResearchQuestion[];
  liquidityObservations: LiquidityObservation[];
  missionCheckpoints: MissionCheckpoint[];
  forecasts: PersonalForecast[];
  forecastRevisions: ForecastRevision[];
  debriefs: MissionDebrief[];
  pendingReviews: number;
  lastLoadedAt: string;
};
