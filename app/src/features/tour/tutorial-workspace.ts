import { spreadMetrics, type SpreadMetrics } from '../../lib/payoff';
import { realizedVerticalPnl } from '../../lib/trade-lifecycle';
import { createTutorialFixture, tutorialStory, type TutorialFixture } from './tutorial-fixtures';

export type TutorialCatalyst = {
  id: string;
  event: string;
  ticker: string;
  date: string;
  time: string;
  category: string;
  visibility: 'private';
};

export type TutorialIdea = {
  id: string;
  ticker: string;
  strategy: string;
  bias: string;
  status: 'watchlist';
  catalystId: string;
  thesis: string;
  evidence: string;
  entryConditions: string;
  invalidation: string;
  plannedExit: string;
};

export type TutorialCandidate = {
  id: string;
  longStrike: number;
  shortStrike: number;
  debit: number;
  contracts: number;
  expiration: string;
  metrics: SpreadMetrics;
};

export type TutorialTrade = {
  id: string;
  actualDebit: number;
  openedAt: string;
  metrics: SpreadMetrics;
};

export type TutorialWorkspace = {
  kind: 'tutorial';
  sessionId: string;
  fixture: TutorialFixture;
  catalyst?: TutorialCatalyst;
  intelligenceReviewed: boolean;
  scenarioPrice: number;
  idea?: TutorialIdea;
  candidate?: TutorialCandidate;
  trade?: TutorialTrade;
  checkin?: { id: string; thesisHealth: 'intact'; note: string };
  exit?: { id: string; value: number; realizedPnl: number };
  debrief?: { id: string; lesson: string };
};

export function createTutorialWorkspace(sessionId: string, now = new Date()): TutorialWorkspace {
  return {
    kind: 'tutorial',
    sessionId,
    fixture: createTutorialFixture(now),
    intelligenceReviewed: false,
    scenarioPrice: 104,
  };
}

export function createTutorialCatalyst(workspace: TutorialWorkspace, input?: Partial<Omit<TutorialCatalyst, 'id' | 'visibility'>>): TutorialWorkspace {
  return {
    ...workspace,
    catalyst: {
      id: `tutorial-catalyst-${workspace.sessionId}`,
      event: input?.event || tutorialStory.event,
      ticker: input?.ticker || tutorialStory.ticker,
      date: input?.date || workspace.fixture.catalystDate,
      time: input?.time || '16:05',
      category: input?.category || 'Earnings',
      visibility: 'private',
    },
  };
}

export function reviewTutorialIntelligence(workspace: TutorialWorkspace, scenarioPrice: number): TutorialWorkspace {
  if (!workspace.catalyst) throw new Error('Create the Tutorial Catalyst first.');
  if (!Number.isFinite(scenarioPrice) || scenarioPrice <= 0) throw new Error('Enter a valid scenario price.');
  return { ...workspace, intelligenceReviewed: true, scenarioPrice };
}

export function saveTutorialIdea(workspace: TutorialWorkspace, input?: Partial<Omit<TutorialIdea, 'id' | 'catalystId' | 'status'>>): TutorialWorkspace {
  if (!workspace.catalyst || !workspace.intelligenceReviewed) throw new Error('Review the Tutorial Catalyst and its Intelligence first.');
  return {
    ...workspace,
    idea: {
      id: `tutorial-idea-${workspace.sessionId}`,
      ticker: input?.ticker || tutorialStory.ticker,
      strategy: input?.strategy || tutorialStory.strategy,
      bias: input?.bias || tutorialStory.bias,
      status: 'watchlist',
      catalystId: workspace.catalyst.id,
      thesis: input?.thesis || tutorialStory.thesis,
      evidence: input?.evidence || tutorialStory.evidence,
      entryConditions: input?.entryConditions || tutorialStory.entryConditions,
      invalidation: input?.invalidation || tutorialStory.invalidation,
      plannedExit: input?.plannedExit || tutorialStory.plannedExit,
    },
  };
}

export function saveTutorialCandidate(workspace: TutorialWorkspace, input?: { longStrike?: number; shortStrike?: number; debit?: number; contracts?: number }): TutorialWorkspace {
  if (!workspace.idea) throw new Error('Save the Tutorial Idea first.');
  const longStrike = input?.longStrike ?? tutorialStory.longStrike;
  const shortStrike = input?.shortStrike ?? tutorialStory.shortStrike;
  const debit = input?.debit ?? tutorialStory.plannedDebit;
  const contracts = input?.contracts ?? tutorialStory.contracts;
  const metrics = spreadMetrics('bull-call-spread', longStrike, shortStrike, debit, contracts);
  if (!metrics) throw new Error('Enter a valid bull call spread Candidate.');
  return {
    ...workspace,
    candidate: {
      id: `tutorial-candidate-${workspace.sessionId}`,
      longStrike,
      shortStrike,
      debit,
      contracts,
      expiration: workspace.fixture.expiration,
      metrics,
    },
  };
}

export function recordTutorialTrade(workspace: TutorialWorkspace, actualDebit = tutorialStory.actualDebit): TutorialWorkspace {
  if (!workspace.candidate) throw new Error('Save the Tutorial Candidate first.');
  const metrics = spreadMetrics('bull-call-spread', workspace.candidate.longStrike, workspace.candidate.shortStrike, actualDebit, workspace.candidate.contracts);
  if (!metrics) throw new Error('Enter a valid actual fill.');
  return {
    ...workspace,
    trade: {
      id: `tutorial-trade-${workspace.sessionId}`,
      actualDebit,
      openedAt: workspace.fixture.observedAt,
      metrics,
    },
  };
}

export function addTutorialCheckin(workspace: TutorialWorkspace, note = tutorialStory.checkin): TutorialWorkspace {
  if (!workspace.trade) throw new Error('Record the Tutorial Trade first.');
  if (!note.trim()) throw new Error('Add one concise monitoring note.');
  return { ...workspace, checkin: { id: `tutorial-checkin-${workspace.sessionId}`, thesisHealth: 'intact', note: note.trim() } };
}

export function recordTutorialExit(workspace: TutorialWorkspace, value = tutorialStory.exitValue): TutorialWorkspace {
  if (!workspace.trade || !workspace.candidate) throw new Error('Record and monitor the Tutorial Trade first.');
  const realizedPnl = realizedVerticalPnl(workspace.trade.actualDebit, 0, value, 'credit', 0, workspace.candidate.contracts);
  if (realizedPnl === null) throw new Error('Enter a valid Tutorial exit value.');
  return { ...workspace, exit: { id: `tutorial-exit-${workspace.sessionId}`, value, realizedPnl } };
}

export function saveTutorialDebrief(workspace: TutorialWorkspace, lesson = tutorialStory.lesson): TutorialWorkspace {
  if (!workspace.exit) throw new Error('Record the Tutorial Exit first.');
  if (!lesson.trim()) throw new Error('Add one short lesson.');
  return { ...workspace, debrief: { id: `tutorial-debrief-${workspace.sessionId}`, lesson: lesson.trim() } };
}

export function clearTutorialWorkspace(workspace: TutorialWorkspace): TutorialWorkspace {
  return createTutorialWorkspace(workspace.sessionId, new Date(workspace.fixture.observedAt));
}

export function reconstructTutorialWorkspace(stage: number, sessionId: string, now = new Date()): TutorialWorkspace {
  let workspace = createTutorialWorkspace(sessionId, now);
  if (stage >= 1) workspace = createTutorialCatalyst(workspace);
  if (stage >= 2) workspace = reviewTutorialIntelligence(workspace, 104);
  if (stage >= 3) workspace = saveTutorialIdea(workspace);
  if (stage >= 4) workspace = saveTutorialCandidate(workspace);
  if (stage >= 5) workspace = recordTutorialTrade(workspace);
  if (stage >= 6) workspace = addTutorialCheckin(workspace);
  if (stage >= 7) workspace = recordTutorialExit(workspace);
  if (stage >= 8) workspace = saveTutorialDebrief(workspace);
  return workspace;
}

export function tutorialStageComplete(workspace: TutorialWorkspace, stage: number): boolean {
  return [
    Boolean(workspace.catalyst),
    workspace.intelligenceReviewed,
    Boolean(workspace.idea),
    Boolean(workspace.candidate),
    Boolean(workspace.trade),
    Boolean(workspace.checkin),
    Boolean(workspace.exit),
    Boolean(workspace.debrief),
    Boolean(workspace.debrief),
  ][stage] ?? false;
}
