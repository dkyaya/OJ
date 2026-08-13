import { describe, expect, it } from 'vitest';
import { analyzeOptionChain, optionMidpoint, parseStoredOptionChain } from './option-chain';
import type { MarketSnapshot } from './types';

const contract = (strike: number, optionSide: 'call' | 'put', overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  provider: 'fixture-provider', sourceQuality: 'secondary', observedAt: '2026-08-13T13:00:00Z', fetchedAt: '2026-08-13T13:05:00Z', freshness: 'delayed',
  ticker: 'SYNTH', underlyingPrice: 102.5, expiration: '2026-09-18', contractSymbol: `SYNTH-${strike}-${optionSide}`, optionSide, strike,
  bid: optionSide === 'call' ? 2 : 1.8, ask: optionSide === 'call' ? 2.4 : 2.2, impliedVolatility: 0.25,
  methodology: 'Synthetic option-chain fixture.', provenance: 'provider', ...overrides,
});

describe('option-chain transformation', () => {
  it('pairs calls and puts by strike and marks the deterministic nearest ATM row', () => {
    const result = analyzeOptionChain([100, 105, 110].flatMap((strike) => [contract(strike, 'call'), contract(strike, 'put')]));
    expect(result?.rows).toHaveLength(3);
    expect(result?.contractCount).toBe(6);
    expect(result?.atmStrike).toBe(100); // 102.5 is an exact tie; lower strike wins.
    expect(result?.rows.find((row) => row.atm)).toMatchObject({ strike: 100, call: { optionSide: 'call' }, put: { optionSide: 'put' } });
    expect(result?.atmSummary).toMatchObject({ callMidpoint: 2.2, putMidpoint: 2 });
    expect(result?.atmSummary?.percentMove).toBeCloseTo((4.2 / 102.5) * 100);
  });

  it('keeps incomplete rows, missing IV, zero bid/ask, and one-sided chains usable', () => {
    const result = analyzeOptionChain([
      contract(100, 'call', { bid: 0, ask: 0, impliedVolatility: undefined }),
      contract(105, 'put', { bid: undefined, ask: 1.1, midpoint: 0.9 }),
    ]);
    expect(result?.rows).toHaveLength(2);
    expect(result?.rows[0].put).toBeUndefined();
    expect(optionMidpoint(result?.rows[0].call)).toBe(0);
    expect(optionMidpoint(result?.rows[1].put)).toBe(0.9);
    expect(result?.atmSummary).toBeUndefined();
  });

  it('handles unsorted call-only and put-only chains without inventing the missing side', () => {
    const calls = analyzeOptionChain([contract(110, 'call'), contract(100, 'call'), contract(105, 'call')]);
    const puts = analyzeOptionChain([contract(105, 'put'), contract(110, 'put'), contract(100, 'put')]);
    expect(calls?.rows.map((row) => row.strike)).toEqual([100, 105, 110]);
    expect(calls?.rows.every((row) => row.put === undefined)).toBe(true);
    expect(puts?.rows.every((row) => row.call === undefined)).toBe(true);
  });

  it('does not guess ATM or a straddle summary when underlying is missing', () => {
    const result = analyzeOptionChain([contract(100, 'call', { underlyingPrice: undefined }), contract(100, 'put', { underlyingPrice: undefined })]);
    expect(result?.atmStrike).toBeUndefined();
    expect(result?.rows.some((row) => row.atm)).toBe(false);
    expect(result?.atmSummary).toBeUndefined();
  });

  it('deduplicates a same-side strike deterministically in favor of the richer contract', () => {
    const sparse = contract(100, 'call', { contractSymbol: 'A', bid: undefined, ask: undefined, impliedVolatility: undefined });
    const rich = contract(100, 'call', { contractSymbol: 'B', volume: 25, openInterest: 100 });
    expect(analyzeOptionChain([sparse, rich])?.rows[0].call?.contractSymbol).toBe('B');
  });

  it('handles malformed and empty stored chains without throwing', () => {
    expect(parseStoredOptionChain(null)).toEqual([]);
    expect(parseStoredOptionChain([{ ticker: 'SYNTH' }, null, 'raw'])).toEqual([]);
    expect(analyzeOptionChain([])).toBeUndefined();
  });

  it('normalizes snake-case legacy fields', () => {
    const parsed = parseStoredOptionChain([{ ticker: 'synth', option_side: 'put', strike: '100', observed_at: '2026-08-13T13:00:00Z', fetched_at: '2026-08-13T13:05:00Z', underlying_price: '101', open_interest: '42', methodology: 'Legacy fixture.' }]);
    expect(parsed[0]).toMatchObject({ ticker: 'SYNTH', optionSide: 'put', strike: 100, underlyingPrice: 101, openInterest: 42 });
  });
});
