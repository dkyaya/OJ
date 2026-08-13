import { midpoint } from './analytics';
import type { MarketSnapshot, ProviderStatus } from './types';

export const MAX_OPTION_STRIKE_LIMIT = 10;

export type OptionsChainRequest = { ticker: string; expiration: string; side?: 'call' | 'put'; strikeLimit: number; date?: string; forceRefresh?: boolean };

export function validateOptionsChainRequest(input: OptionsChainRequest) {
  const ticker = input.ticker.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,20}$/.test(ticker)) throw new Error('Use one valid ticker.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiration) || input.expiration === 'all') throw new Error('Choose one exact expiration.');
  if (!Number.isInteger(input.strikeLimit) || input.strikeLimit < 1 || input.strikeLimit > MAX_OPTION_STRIKE_LIMIT) throw new Error(`Strike limit must be between 1 and ${MAX_OPTION_STRIKE_LIMIT}.`);
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Historical date must use YYYY-MM-DD.');
  return { ...input, ticker };
}

const at = (value: unknown, index: number) => Array.isArray(value) ? value[index] : undefined;
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const stringValue = (value: unknown) => typeof value === 'string' && value ? value : undefined;

export function normalizeMarketDataChain(raw: Record<string, unknown>, request: OptionsChainRequest, fetchedAt: string): MarketSnapshot[] {
  const symbols = Array.isArray(raw.optionSymbol) ? raw.optionSymbol : [];
  if (!symbols.length) return [];
  const observedEpoch = numeric(at(raw.updated, 0));
  const observedAt = observedEpoch ? new Date(observedEpoch * 1000).toISOString() : fetchedAt;
  return symbols.map((symbol, index) => {
    const bid = numeric(at(raw.bid, index));
    const ask = numeric(at(raw.ask, index));
    return {
      provider: 'marketdata', sourceReference: 'https://www.marketdata.app/docs/api/options/chain/', sourceQuality: 'secondary' as const,
      observedAt, fetchedAt, freshness: request.date ? 'historical' as const : 'delayed' as const, ticker: request.ticker,
      assetType: 'option', underlyingPrice: numeric(at(raw.underlyingPrice, index)) ?? numeric(raw.underlyingPrice), expiration: stringValue(at(raw.expiration, index)) ?? request.expiration,
      contractSymbol: String(symbol), optionSide: (stringValue(at(raw.side, index)) === 'put' ? 'put' : 'call') as 'put' | 'call', strike: numeric(at(raw.strike, index)), bid, ask, midpoint: midpoint(bid, ask),
      last: numeric(at(raw.last, index)), volume: numeric(at(raw.volume, index)), openInterest: numeric(at(raw.openInterest, index)), impliedVolatility: numeric(at(raw.iv, index)),
      delta: numeric(at(raw.delta, index)), gamma: numeric(at(raw.gamma, index)), theta: numeric(at(raw.theta, index)), vega: numeric(at(raw.vega, index)),
      methodology: 'Normalized from a narrowly filtered MarketData option-chain response. Free-tier quotes are delayed.', provenance: 'provider' as const,
    };
  });
}

export function manualOptionsSnapshot(input: Omit<MarketSnapshot, 'provider' | 'fetchedAt' | 'freshness' | 'provenance' | 'sourceQuality'>): MarketSnapshot {
  const fetchedAt = new Date().toISOString();
  return { ...input, provider: 'manual', fetchedAt, freshness: 'manual', provenance: 'manual', sourceQuality: input.sourceReference ? 'primary' : 'unverified', midpoint: input.midpoint ?? midpoint(input.bid, input.ask) };
}

export function providerCacheKey(provider: string, capability: string, parameters: Record<string, unknown>) {
  const stable = Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)));
  return `${provider}:${capability}:${JSON.stringify(stable)}`;
}

export const defaultProviderStatuses: ProviderStatus[] = [
  { id: 'manual', label: 'Manual', availability: 'manual_only', freshness: 'manual', capabilities: ['delayed_options', 'historical_options'], detail: 'Always available; the user supplies source and timestamp.' },
  { id: 'marketdata', label: 'MarketData', availability: 'configuration_needed', freshness: 'delayed', capabilities: ['delayed_options', 'historical_options'], detail: 'Free-tier delayed options; exact expiration, a small strike limit, and a four-request rolling daily guard are mandatory.' },
  { id: 'bls', label: 'BLS', availability: 'available', freshness: 'varies', capabilities: ['macro_series'], detail: 'Public V1 series endpoint; official release data.' },
  { id: 'treasury', label: 'U.S. Treasury', availability: 'available', freshness: 'varies', capabilities: ['treasury_rates'], detail: 'Official public interest-rate feed.' },
  { id: 'sec', label: 'SEC EDGAR', availability: 'configuration_needed', freshness: 'varies', capabilities: ['company_filings'], detail: 'Public filings; a compliant request identity must be configured.' },
  { id: 'fred', label: 'FRED', availability: 'configuration_needed', freshness: 'varies', capabilities: ['macro_series'], detail: 'Free API key required; attribution applies.' },
  { id: 'bea', label: 'BEA', availability: 'configuration_needed', freshness: 'varies', capabilities: ['macro_series'], detail: 'Free API key required.' },
  { id: 'census', label: 'Census', availability: 'configuration_needed', freshness: 'varies', capabilities: ['macro_series'], detail: 'Free API key required for current API access.' },
];
