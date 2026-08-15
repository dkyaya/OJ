import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../../data/demo';
import {
  addTutorialCheckin,
  clearTutorialWorkspace,
  createTutorialCatalyst,
  createTutorialWorkspace,
  recordTutorialExit,
  recordTutorialTrade,
  reconstructTutorialWorkspace,
  reviewTutorialIntelligence,
  saveTutorialCandidate,
  saveTutorialDebrief,
  saveTutorialIdea,
  tutorialStageComplete,
} from './tutorial-workspace';

describe('isolated Tutorial Workspace', () => {
  it('completes the synthetic Catalyst-to-Insights story with production math', () => {
    let workspace = createTutorialWorkspace('full-story', new Date('2026-08-15T12:00:00Z'));
    workspace = createTutorialCatalyst(workspace);
    workspace = reviewTutorialIntelligence(workspace, 104);
    workspace = saveTutorialIdea(workspace);
    workspace = saveTutorialCandidate(workspace);
    expect(workspace.candidate?.metrics).toMatchObject({ width: 5, maxLoss: 140, maxProfit: 360, breakEven: 101.4 });
    workspace = recordTutorialTrade(workspace);
    expect(workspace.trade?.actualDebit).toBe(1.32);
    expect(workspace.trade?.metrics).toMatchObject({ maxLoss: 132, maxProfit: 368, breakEven: 101.32 });
    workspace = addTutorialCheckin(workspace);
    workspace = recordTutorialExit(workspace);
    expect(workspace.exit?.realizedPnl).toBe(78);
    workspace = saveTutorialDebrief(workspace);
    expect(workspace.debrief?.lesson).toContain('strengthened');
    expect(tutorialStageComplete(workspace, 8)).toBe(true);
  });

  it('cannot contaminate risk, Journal, Insights, calibration, collaboration, or exports', () => {
    const realBefore = structuredClone(demoWorkspace);
    let tutorial = reconstructTutorialWorkspace(8, 'exclusion', new Date('2026-08-15T12:00:00Z'));
    expect(tutorial.trade?.metrics.maxLoss).toBe(132);
    expect(demoWorkspace).toEqual(realBefore);
    expect(demoWorkspace.positions).toEqual(realBefore.positions);
    expect(demoWorkspace.journal).toEqual(realBefore.journal);
    expect(demoWorkspace.researchSnapshots).toEqual(realBefore.researchSnapshots);
    expect(demoWorkspace.activity).toEqual(realBefore.activity);
    tutorial = clearTutorialWorkspace(tutorial);
    expect(tutorial.kind).toBe('tutorial');
    expect([tutorial.catalyst, tutorial.idea, tutorial.trade, tutorial.checkin, tutorial.exit, tutorial.debrief]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    expect(demoWorkspace).toEqual(realBefore);
  });

  it('reconstructs only deterministic prerequisites for resume and clears on restart/finish', () => {
    const resumed = reconstructTutorialWorkspace(5, 'resume', new Date('2026-08-15T12:00:00Z'));
    expect(resumed.trade).toBeDefined();
    expect(resumed.checkin).toBeUndefined();
    const cleared = clearTutorialWorkspace(resumed);
    expect(cleared.catalyst).toBeUndefined();
    expect(cleared.fixture.options).toHaveLength(6);
    expect(cleared.sessionId).toBe('resume');
  });

  it('has a structural no-write and no-provider import boundary', () => {
    const sources = [
      readFileSync(new URL('./tutorial-workspace.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./tutorial-fixtures.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../../components/GuidedWalkthrough.tsx', import.meta.url), 'utf8'),
    ].join('\n');
    for (const forbidden of [
      'data/actions', 'collaboration-actions', 'lib/supabase', 'saveCatalystRecord', 'saveTradeIdea', 'saveTradeCandidate',
      'recordEntry', 'saveTradeCheckin', 'recordTradeExit', 'saveDebrief', 'saveResearchSnapshot', 'loadDelayedOptions', 'fetch(',
    ]) expect(sources).not.toContain(forbidden);
  });
});
