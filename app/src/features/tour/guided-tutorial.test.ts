import { describe, expect, it } from 'vitest';
import { createGuidedTutorialState, guidedTutorialActionLabel, guidedTutorialPreferenceData, guidedTutorialSteps, readGuidedTutorialState } from './guided-tutorial';

describe('Guided Walkthrough preference state', () => {
  it('stores only bounded onboarding progress and preserves unrelated preferences', () => {
    const state = createGuidedTutorialState('paused', 4, new Date('2026-08-15T12:00:00Z'));
    expect(guidedTutorialPreferenceData({ productTour: { version: 1 } }, state)).toEqual({ productTour: { version: 1 }, guidedWalkthrough: state });
    expect(Object.keys(state).sort()).toEqual(['stage', 'status', 'updatedAt', 'version']);
    expect(guidedTutorialActionLabel(state)).toBe('Resume Guided Walkthrough');
  });

  it('clamps progress and resets an older version', () => {
    expect(readGuidedTutorialState({ guidedWalkthrough: { version: 1, status: 'in_progress', stage: 999 } }).stage).toBe(guidedTutorialSteps.length - 1);
    expect(readGuidedTutorialState({ guidedWalkthrough: { version: 0, status: 'completed', stage: 8 } })).toMatchObject({ status: 'not_started', stage: 0 });
  });

  it('uses one clear action for a completed walkthrough', () => {
    expect(guidedTutorialActionLabel(createGuidedTutorialState('completed', guidedTutorialSteps.length - 1))).toBe('Replay Guided Walkthrough');
    expect(guidedTutorialActionLabel(createGuidedTutorialState('not_started', 0))).toBe('Start Guided Walkthrough');
  });
});
