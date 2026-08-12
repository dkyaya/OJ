import { describe, expect, it } from 'vitest';
import { forecastWindow } from './forecast-window';

describe('forecast window', () => {
  it('closes after the server cutoff', () => {
    const window = forecastWindow('2026-08-06T12:00:00Z', Date.parse('2026-08-11T12:00:00Z'));
    expect(window.closed).toBe(true);
    expect(window.reason).toBe('passed');
  });

  it('stays open before the server cutoff', () => {
    const window = forecastWindow('2026-08-12T12:00:00Z', Date.parse('2026-08-11T12:00:00Z'));
    expect(window.closed).toBe(false);
    expect(window.reason).toBe('open');
  });

  it('fails closed when no valid cutoff is scheduled', () => {
    expect(forecastWindow()).toEqual({ closed: true, reason: 'unscheduled' });
    expect(forecastWindow('not-a-date')).toEqual({ closed: true, reason: 'unscheduled' });
  });
});
