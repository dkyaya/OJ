import { describe, expect, it } from 'vitest';
import { tradingSessionLabel } from './timeline';

describe('trading-session timeline', () => {
  const sessions = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-17'];
  it('derives labels from supplied trading sessions rather than calendar arithmetic', () => {
    expect(tradingSessionLabel('2026-08-04', '2026-08-11', sessions)).toBe('T-5');
    expect(tradingSessionLabel('2026-08-10', '2026-08-11', sessions)).toBe('T-1');
    expect(tradingSessionLabel('2026-08-12', '2026-08-11', sessions)).toBe('T+1');
  });
});
