export const GUIDED_TUTORIAL_VERSION = 1;

export type GuidedTutorialStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'skipped';

export type GuidedTutorialState = {
  version: number;
  status: GuidedTutorialStatus;
  stage: number;
  updatedAt?: string;
};

export const guidedTutorialSteps = [
  { id: 'catalyst', title: 'Create a Catalyst', eyebrow: 'Scheduled fact' },
  { id: 'intelligence', title: 'Inspect Catalyst Intelligence', eyebrow: 'Priced uncertainty' },
  { id: 'idea', title: 'Build an Idea', eyebrow: 'Your interpretation' },
  { id: 'candidate', title: 'Save a Candidate', eyebrow: 'The plan' },
  { id: 'trade', title: 'Record the Fill', eyebrow: 'What happened elsewhere' },
  { id: 'monitoring', title: 'Add a Check-In', eyebrow: 'Monitor the live thesis' },
  { id: 'exit', title: 'Record the Exit', eyebrow: 'Close the history' },
  { id: 'debrief', title: 'Write the Debrief', eyebrow: 'Reflect after the outcome' },
  { id: 'insights', title: 'Understand Insights', eyebrow: 'Learn from real history' },
] as const;

const defaultState = (): GuidedTutorialState => ({ version: GUIDED_TUTORIAL_VERSION, status: 'not_started', stage: 0 });

export function readGuidedTutorialState(data: unknown): GuidedTutorialState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return defaultState();
  const raw = (data as Record<string, unknown>).guidedWalkthrough;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultState();
  const value = raw as Record<string, unknown>;
  if (value.version !== GUIDED_TUTORIAL_VERSION) return defaultState();
  const status = typeof value.status === 'string' && ['not_started', 'in_progress', 'paused', 'completed', 'skipped'].includes(value.status)
    ? value.status as GuidedTutorialStatus
    : 'not_started';
  const rawStage = typeof value.stage === 'number' && Number.isFinite(value.stage) ? Math.floor(value.stage) : 0;
  return {
    version: GUIDED_TUTORIAL_VERSION,
    status,
    stage: Math.max(0, Math.min(guidedTutorialSteps.length - 1, rawStage)),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

export function createGuidedTutorialState(status: GuidedTutorialStatus, stage = 0, now = new Date()): GuidedTutorialState {
  return {
    version: GUIDED_TUTORIAL_VERSION,
    status,
    stage: Math.max(0, Math.min(guidedTutorialSteps.length - 1, Math.floor(stage))),
    updatedAt: now.toISOString(),
  };
}

export function guidedTutorialPreferenceData(data: Record<string, unknown> | undefined, state: GuidedTutorialState) {
  return { ...(data || {}), guidedWalkthrough: state };
}

export function guidedTutorialActionLabel(state: GuidedTutorialState) {
  if (state.status === 'paused' || state.status === 'in_progress') return 'Resume Guided Walkthrough';
  if (state.status === 'completed') return 'Replay Guided Walkthrough';
  return 'Start Guided Walkthrough';
}
