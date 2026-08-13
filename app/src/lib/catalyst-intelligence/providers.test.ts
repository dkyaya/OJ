import { describe, expect, it } from 'vitest';
import { manualOptionsSnapshot, normalizeMarketDataChain, providerCacheKey, validateOptionsChainRequest } from './providers';

describe('provider contracts and quota guards', () => {
  it('rejects unrestricted chains and enforces one narrow expiration', () => {
    expect(() => validateOptionsChainRequest({ ticker: 'SPY', expiration: 'all', strikeLimit: 10 })).toThrow('exact expiration');
    expect(() => validateOptionsChainRequest({ ticker: 'SPY', expiration: '2026-08-21', strikeLimit: 100 })).toThrow('Strike limit');
    expect(validateOptionsChainRequest({ ticker: 'spy', expiration: '2026-08-21', strikeLimit: 6 }).ticker).toBe('SPY');
  });

  it('normalizes delayed provider rows and calculates midpoint', () => {
    const rows = normalizeMarketDataChain({ optionSymbol: ['SPY260821C00650000'], side: ['call'], strike: [650], bid: [1], ask: [1.4], iv: [0.2], underlyingPrice: [650], expiration: ['2026-08-21'], updated: [1786500000] }, { ticker: 'SPY', expiration: '2026-08-21', strikeLimit: 6 }, '2026-08-12T20:00:00Z');
    expect(rows[0]).toMatchObject({ provider: 'marketdata', freshness: 'delayed', midpoint: 1.2, ticker: 'SPY' });
  });

  it('marks dated responses historical and handles malformed/no-data payloads safely', () => {
    const historical = normalizeMarketDataChain({ optionSymbol: ['SPY260821P00650000'], side: ['put'], strike: ['650'], bid: ['1'], ask: ['1.2'] }, { ticker: 'SPY', expiration: '2026-08-21', date: '2026-08-01', strikeLimit: 2 }, '2026-08-12T20:00:00Z');
    expect(historical[0].freshness).toBe('historical');
    expect(normalizeMarketDataChain({ unexpected: true }, { ticker: 'SPY', expiration: '2026-08-21', strikeLimit: 2 }, '2026-08-12T20:00:00Z')).toEqual([]);
  });

  it('keeps manual observations in the same normalized model', () => {
    const snapshot = manualOptionsSnapshot({ ticker: 'SPY', sourceReference: 'Brokerage screen (transcribed; no connection)', observedAt: '2026-08-12T20:00:00Z', methodology: 'Manual bid/ask transcription.', bid: 1, ask: 1.4 });
    expect(snapshot).toMatchObject({ provider: 'manual', freshness: 'manual', provenance: 'manual', midpoint: 1.2 });
  });

  it('generates stable cache keys independent of parameter order', () => {
    expect(providerCacheKey('marketdata', 'options', { ticker: 'SPY', expiration: '2026-08-21' })).toBe(providerCacheKey('marketdata', 'options', { expiration: '2026-08-21', ticker: 'SPY' }));
  });
});
