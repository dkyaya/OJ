import { describe, expect, it } from 'vitest';
import { personalCalibration } from './collaboration';
import type { MissionDebrief, PersonalForecast } from '../types/domain';

const forecast = (id: string, direction: PersonalForecast['marketDirection'], confidence: number, magnitude?: number): PersonalForecast => ({
  id, userId: 'owner', workspaceId: 'workspace', catalystId: `c-${id}`, expectedResult: 'Synthetic', marketDirection: direction,
  expectedMagnitude: magnitude, magnitudeUnit: 'percent', confidence, tradeDecision: 'watch', visibility: 'private', revision: 1,
  lockedAt: '2026-08-01T10:00:00Z', createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T10:00:00Z',
});
const debrief = (id: string, direction: MissionDebrief['actualDirection'], magnitude?: number): MissionDebrief => ({
  id: `d-${id}`, workspaceId: 'workspace', missionId: `m-${id}`, catalystId: `c-${id}`, authorId: 'owner', actualResult: 'Synthetic result', actualDirection: direction,
  actualMagnitude: magnitude, marketReaction: 'Synthetic reaction', visibility: 'private', createdAt: '2026-08-02T10:00:00Z', updatedAt: '2026-08-02T10:00:00Z',
});

describe('personal forecast calibration', () => {
  it('uses only the requested user, locked forecasts, and classified outcomes', () => {
    const forecasts = [forecast('one', 'bullish', 60, 1), forecast('two', 'bearish', 80, 2), { ...forecast('other', 'bullish', 99), userId: 'other' }, { ...forecast('draft', 'neutral', 50), lockedAt: undefined }];
    const result = personalCalibration('owner', forecasts, [debrief('one', 'bullish', 1.5), debrief('two', 'neutral', 1)]);
    expect(result.count).toBe(2);
    expect(result.directionAccuracy).toBe(0.5);
    expect(result.averageConfidence).toBe(70);
    expect(result.averageMagnitudeError).toBe(0.75);
  });

  it('does not fabricate rates when outcomes are absent', () => {
    expect(personalCalibration('owner', [forecast('one', 'bullish', 60)], [])).toEqual({ count: 0, directionAccuracy: undefined, averageConfidence: undefined, averageMagnitudeError: undefined });
  });
});
