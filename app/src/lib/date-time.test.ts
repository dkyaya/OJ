import { describe, expect, it } from 'vitest';
import { zonedEventIso } from './date-time';

describe('zonedEventIso', () => {
  it('records New York standard time explicitly', () => {
    expect(zonedEventIso('2026-01-09', '08:30', 'America/New_York')).toBe('2026-01-09T13:30:00.000Z');
  });

  it('records New York daylight time explicitly', () => {
    expect(zonedEventIso('2026-08-07', '08:30', 'America/New_York')).toBe('2026-08-07T12:30:00.000Z');
  });
});

