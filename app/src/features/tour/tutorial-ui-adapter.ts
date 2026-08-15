import { createCatalystEditorValues, type CatalystEditorValues } from '../../components/editors/CatalystEditor';
import { initialIdeaData } from '../ideas/canonical';
import { spreadMetrics } from '../../lib/payoff';
import type { Catalyst, JournalRecord, Position, ResearchSnapshot, TradeCheckin, TradeExit, TradeIdea, Workspace } from '../../types/domain';
import { tutorialStory } from './tutorial-fixtures';
import type { TutorialWorkspace } from './tutorial-workspace';

export function tutorialCatalystEditorValues(workspace: TutorialWorkspace): CatalystEditorValues {
  return {
    ...createCatalystEditorValues(new Date(workspace.fixture.observedAt)),
    event: workspace.catalyst?.event || tutorialStory.event,
    type: workspace.catalyst?.category || 'Earnings',
    date: workspace.catalyst?.date || workspace.fixture.catalystDate,
    time: workspace.catalyst?.time || '16:05',
    marketSession: 'after_hours',
    source: 'Tutorial Fixture',
    sourceQuality: 'unverified',
    sensitivity: 'High',
    whyMatters: 'Practice separating a scheduled factual event from a private trading thesis.',
    keyVariables: 'Revenue, guidance, post-event price confirmation',
    tags: 'tutorial, synthetic, OJDEMO',
  };
}

export function tutorialIdeaEditorData(workspace: TutorialWorkspace): Record<string, string> {
  const idea = workspace.idea;
  const candidate = workspace.candidate;
  return {
    ...initialIdeaData('ticker'),
    Ticker: idea?.ticker || tutorialStory.ticker,
    'Asset Type': 'Equity',
    Strategy: idea?.strategy || tutorialStory.strategy,
    Bias: idea?.bias || tutorialStory.bias,
    Status: 'Watchlist',
    'Catalyst setup': 'Use Existing',
    'Existing catalyst ID': workspace.catalyst?.id || '',
    Thesis: idea?.thesis || tutorialStory.thesis,
    Evidence: idea?.evidence || tutorialStory.evidence,
    'Entry conditions': idea?.entryConditions || tutorialStory.entryConditions,
    'Planned exit': idea?.plannedExit || tutorialStory.plannedExit,
    Invalidation: idea?.invalidation || tutorialStory.invalidation,
    'Hold through events': 'OJ Tutorial Co. Q2 Earnings',
    'Avoid events': 'Synthetic expiration week',
    Expiration: candidate?.expiration || workspace.fixture.expiration,
    'Long strike': String(candidate?.longStrike ?? tutorialStory.longStrike),
    'Short strike': String(candidate?.shortStrike ?? tutorialStory.shortStrike),
    'Net debit': String(candidate?.debit ?? tutorialStory.plannedDebit),
    Contracts: String(candidate?.contracts ?? tutorialStory.contracts),
    Confidence: 'Moderate',
  };
}

function catalystView(workspace: TutorialWorkspace): Catalyst {
  const catalyst = workspace.catalyst;
  return {
    id: catalyst?.id || `tutorial-catalyst-${workspace.sessionId}`,
    event: catalyst?.event || tutorialStory.event,
    type: catalyst?.category || 'Earnings',
    category: catalyst?.category || 'Earnings',
    date: catalyst?.date || workspace.fixture.catalystDate,
    eventAt: `${catalyst?.date || workspace.fixture.catalystDate}T20:05:00.000Z`,
    scheduleKind: 'scheduled', scheduledTime: catalyst?.time || '16:05', timezoneName: 'America/New_York', marketSession: 'after_hours', dateCertainty: 'confirmed', eventStatus: 'scheduled',
    sensitivity: 'High', status: 'scheduled', source: 'Tutorial Fixture', sourceQuality: 'unverified', whyMatters: 'Synthetic event used only inside the Guided Walkthrough.', keyVariables: ['Revenue', 'Guidance'], tags: ['tutorial', 'synthetic'], linkedTickers: [tutorialStory.ticker], revision: 1, data: { tutorial: true }, visibility: 'private',
  };
}

function ideaView(workspace: TutorialWorkspace, previewCandidate: boolean): TradeIdea {
  const idea = workspace.idea; const candidate = workspace.candidate;
  const candidateMetrics = candidate?.metrics || spreadMetrics('bull-call-spread', tutorialStory.longStrike, tutorialStory.shortStrike, tutorialStory.plannedDebit, tutorialStory.contracts)!;
  return {
    id: idea?.id || `tutorial-idea-${workspace.sessionId}`, ticker: idea?.ticker || tutorialStory.ticker, assetType: 'Equity', strategy: idea?.strategy || tutorialStory.strategy,
    bias: idea?.bias || tutorialStory.bias, status: 'watchlist', confidence: 'moderate', thesis: idea?.thesis || tutorialStory.thesis, evidence: idea?.evidence || tutorialStory.evidence,
    entryConditions: idea?.entryConditions || tutorialStory.entryConditions, invalidation: idea?.invalidation || tutorialStory.invalidation, plannedExit: idea?.plannedExit || tutorialStory.plannedExit,
    holdThroughEvents: [tutorialStory.event], avoidEvents: ['Synthetic expiration week'], catalystId: catalystView(workspace).id, researchStage: 'entry_candidate', exposureTags: ['tutorial'], riskOvershootAcknowledged: false,
    updatedAt: workspace.fixture.observedAt, revision: 1, data: { tutorial: true }, candidates: (candidate || previewCandidate) ? [{ id: candidate?.id || `tutorial-candidate-${workspace.sessionId}`, name: 'Candidate', revision: 1, expiration: candidate?.expiration || workspace.fixture.expiration, longStrike: candidate?.longStrike ?? tutorialStory.longStrike, shortStrike: candidate?.shortStrike ?? tutorialStory.shortStrike, debit: candidate?.debit ?? tutorialStory.plannedDebit, contracts: candidate?.contracts ?? tutorialStory.contracts, maxLoss: candidateMetrics.maxLoss, maxProfit: candidateMetrics.maxProfit, breakEven: candidateMetrics.breakEven }] : [],
  };
}

function snapshotView(workspace: TutorialWorkspace, catalyst: Catalyst): ResearchSnapshot {
  return {
    id: `tutorial-snapshot-${workspace.sessionId}`, catalystId: catalyst.id, tradeIdeaId: `tutorial-idea-${workspace.sessionId}`, ticker: tutorialStory.ticker,
    snapshotType: 'market_pricing', observedAt: workspace.fixture.observedAt, methodology: 'Bundled synthetic tutorial fixture; no provider request made.',
    values: { market_snapshot_version: '1.0', underlying_price: 100, expiration: workspace.fixture.expiration, option_chain: workspace.fixture.options },
    provider: 'Tutorial Fixture', sourceQuality: 'unverified', freshness: 'manual', fetchedAt: workspace.fixture.observedAt, sourceReference: 'Bundled synthetic options snapshot', sourceDate: workspace.fixture.observedAt.slice(0, 10), catalystTimezone: 'America/New_York', catalystSession: 'after_hours',
  };
}

function positionView(workspace: TutorialWorkspace, idea: TradeIdea, catalyst: Catalyst): Position | undefined {
  if (!workspace.trade || !workspace.candidate) return undefined;
  const checkins: TradeCheckin[] = workspace.checkin ? [{ id: workspace.checkin.id, tradeId: workspace.trade.id, ideaId: idea.id, thesisHealth: workspace.checkin.thesisHealth, checkedAt: workspace.fixture.observedAt, whatChanged: workspace.checkin.note, priceChanged: true, catalystChanged: false, volatilityChanged: false, macroChanged: false, plannedExitState: 'still_valid', invalidationOccurred: false, data: { tutorial: true } }] : [];
  const exit: TradeExit | undefined = workspace.exit ? { id: workspace.exit.id, tradeId: workspace.trade.id, ideaId: idea.id, exitedAt: workspace.fixture.observedAt, contractsExited: workspace.candidate.contracts, exitValue: workspace.exit.value, exitValueType: 'credit', fees: 0, realizedPnl: workspace.exit.realizedPnl, exitReason: 'target_reached', thesisHealth: 'intact', data: { tutorial: true } } : undefined;
  return {
    id: workspace.trade.id, ideaId: idea.id, candidateId: workspace.candidate.id, ticker: idea.ticker, strategy: idea.strategy, status: exit ? 'closed' : 'active', contracts: workspace.candidate.contracts,
    maxRisk: workspace.trade.metrics.maxLoss, maxProfit: workspace.trade.metrics.maxProfit, breakEven: workspace.trade.metrics.breakEven, expiration: workspace.candidate.expiration, longStrike: workspace.candidate.longStrike, shortStrike: workspace.candidate.shortStrike,
    actualDebit: workspace.trade.actualDebit, entryFees: 0, tradeClass: 'pre_catalyst_anticipation', originatingCatalystId: catalyst.id, exposureTags: ['tutorial'], openedAt: workspace.trade.openedAt, closedAt: exit?.exitedAt, checkins, exit, revision: 1, data: { tutorial: true },
    entryContext: { version: 1, capturedAt: workspace.trade.openedAt, ideaId: idea.id, ideaRevision: 1, ideaStatus: 'watchlist', researchStage: 'entry_candidate', assetType: 'Equity', bias: idea.bias, thesis: idea.thesis, evidence: idea.evidence, entryConditions: idea.entryConditions, invalidation: idea.invalidation, plannedExit: idea.plannedExit, holdThroughEvents: idea.holdThroughEvents, avoidEvents: idea.avoidEvents, candidate: { id: workspace.candidate.id, revision: 1, expiration: workspace.candidate.expiration, longStrike: workspace.candidate.longStrike, shortStrike: workspace.candidate.shortStrike, plannedDebit: workspace.candidate.debit, plannedContracts: workspace.candidate.contracts, plannedMaxLoss: workspace.candidate.metrics.maxLoss, plannedMaxProfit: workspace.candidate.metrics.maxProfit, plannedBreakEven: workspace.candidate.metrics.breakEven }, actual: { expiration: workspace.candidate.expiration, longStrike: workspace.candidate.longStrike, shortStrike: workspace.candidate.shortStrike, contracts: workspace.candidate.contracts, debit: workspace.trade.actualDebit, fees: 0, maxLoss: workspace.trade.metrics.maxLoss, maxProfit: workspace.trade.metrics.maxProfit, breakEven: workspace.trade.metrics.breakEven }, originatingCatalystId: catalyst.id, linkedCatalysts: [{ catalystId: catalyst.id, relationship: 'primary' }], researchSnapshotIds: [`tutorial-snapshot-${workspace.sessionId}`], forecastIds: [], tradeClass: 'pre_catalyst_anticipation', exposureTags: ['tutorial'] },
  };
}

export function tutorialUiWorkspace(workspace: TutorialWorkspace, options: { previewIdea?: boolean; previewCandidate?: boolean } = {}): Workspace {
  const catalyst = catalystView(workspace);
  const includeIdea = Boolean(workspace.idea || options.previewIdea || options.previewCandidate);
  const idea = ideaView(workspace, Boolean(options.previewCandidate));
  const position = positionView(workspace, idea, catalyst);
  const journal: JournalRecord[] = workspace.debrief && position ? [{ id: workspace.debrief.id, ideaId: idea.id, tradeId: position.id, kind: 'review', createdAt: workspace.fixture.observedAt, summary: workspace.debrief.lesson, data: { tutorial: true } }] : [];
  return {
    authenticated: true, approved: true, demo: false, ideas: includeIdea ? [idea] : [], archivedIdeas: [], catalysts: [catalyst], ideaCatalystLinks: includeIdea ? [{ id: `tutorial-link-${workspace.sessionId}`, tradeIdeaId: idea.id, catalystId: catalyst.id, relationship: 'primary' }] : [],
    researchSources: [], researchSnapshots: [snapshotView(workspace, catalyst)], removedResearchSnapshots: [], positions: position ? [position] : [], journal, opportunities: [],
    profile: { id: `tutorial-user-${workspace.sessionId}`, email: 'tutorial@invalid.example', displayName: 'Tutorial User', initials: 'TU', role: 'owner', status: 'active' },
    policy: { totalCapital: 1200, maximumOpenRisk: 800, strategies: ['bull-call-spread'], effectiveDate: workspace.fixture.observedAt.slice(0, 10), version: 1 },
    workspaceMembers: [], pendingWorkspaceInvites: [], evidence: [], evidenceResponses: [], sharedTheses: [], sharedThesisResponses: [], activity: [], missions: [], missionAssignments: [], researchQuestions: [], liquidityObservations: [], missionCheckpoints: [], forecasts: [], forecastRevisions: [], debriefs: [], pendingReviews: 0, lastLoadedAt: workspace.fixture.observedAt,
  };
}
