import { describe, expect, it } from 'vitest';
import { dateKey } from '../lib/calendar';

describe('calendar date keys', () => {
  it('uses the local calendar day instead of UTC rollover', () => {
    expect(dateKey(new Date(2026, 7, 8, 23, 30))).toBe('2026-08-08');
  });
});
