import { midpoint, straddleImpliedMove } from './analytics';
import type { DataFreshness, MarketSnapshot, OptionSide } from './types';

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const pick = (row: Record<string, unknown>, camel: string, snake: string) => row[camel] ?? row[snake];
const freshness = (value: unknown): DataFreshness => ['current', 'delayed', 'historical', 'manual'].includes(String(value)) ? value as DataFreshness : 'manual';
const quality = (value: unknown): MarketSnapshot['sourceQuality'] => ['official', 'primary', 'secondary', 'unverified'].includes(String(value)) ? value as MarketSnapshot['sourceQuality'] : 'unverified';
const side = (value: unknown): OptionSide | undefined => value === 'call' || value === 'put' ? value : undefined;

export function parseStoredOptionChain(value: unknown): MarketSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row) return [];
    const optionSide = side(pick(row, 'optionSide', 'option_side'));
    const strike = finite(row.strike);
    const ticker = text(row.ticker);
    if (!optionSide || strike === undefined || strike <= 0 || !ticker) return [];
    const observedAt = text(pick(row, 'observedAt', 'observed_at')) || text(pick(row, 'fetchedAt', 'fetched_at')) || '';
    const fetchedAt = text(pick(row, 'fetchedAt', 'fetched_at')) || observedAt;
    return [{
      provider: text(row.provider) || 'manual',
      sourceReference: text(pick(row, 'sourceReference', 'source_reference')),
      sourceQuality: quality(pick(row, 'sourceQuality', 'source_quality')),
      observedAt,
      fetchedAt,
      freshness: freshness(row.freshness),
      ticker: ticker.toUpperCase(),
      assetType: text(pick(row, 'assetType', 'asset_type')),
      underlyingPrice: finite(pick(row, 'underlyingPrice', 'underlying_price')),
      expiration: text(row.expiration),
      contractSymbol: text(pick(row, 'contractSymbol', 'contract_symbol')),
      optionSide,
      strike,
      bid: finite(row.bid), ask: finite(row.ask), midpoint: finite(row.midpoint), last: finite(row.last),
      volume: finite(row.volume), openInterest: finite(pick(row, 'openInterest', 'open_interest')),
      impliedVolatility: finite(pick(row, 'impliedVolatility', 'implied_volatility')),
      delta: finite(row.delta), gamma: finite(row.gamma), theta: finite(row.theta), vega: finite(row.vega),
      methodology: text(row.methodology) || 'Stored option-chain observation.',
      provenance: row.provenance === 'provider' ? 'provider' : 'manual',
      sessionLabel: text(pick(row, 'sessionLabel', 'session_label')) as MarketSnapshot['sessionLabel'],
      sourceDate: text(pick(row, 'sourceDate', 'source_date')),
      calendarDaysToCatalyst: finite(pick(row, 'calendarDaysToCatalyst', 'calendar_days_to_catalyst')),
      catalystTimezone: text(pick(row, 'catalystTimezone', 'catalyst_timezone')),
      catalystSession: text(pick(row, 'catalystSession', 'catalyst_session')),
    }];
  });
}

export type OptionChainRow = { strike: number; call?: MarketSnapshot; put?: MarketSnapshot; atm: boolean };
export type OptionChainAnalysis = {
  ticker: string;
  expiration?: string;
  underlyingPrice?: number;
  provider: string;
  freshness: DataFreshness;
  observedAt?: string;
  fetchedAt?: string;
  sourceReference?: string;
  methodology?: string;
  contractCount: number;
  atmStrike?: number;
  rows: OptionChainRow[];
  atmSummary?: { callMidpoint: number; putMidpoint: number; dollarMove: number; percentMove: number };
};

export const optionMidpoint = (contract?: MarketSnapshot) => {
  if (!contract) return undefined;
  return midpoint(contract.bid, contract.ask) ?? contract.midpoint;
};

const completeness = (contract: MarketSnapshot) => [contract.bid, contract.ask, contract.midpoint, contract.impliedVolatility, contract.volume, contract.openInterest, contract.delta, contract.gamma, contract.theta, contract.vega].filter((item) => item !== undefined).length;
const preferredContract = (left: MarketSnapshot, right: MarketSnapshot) => {
  const score = completeness(right) - completeness(left);
  if (score) return score > 0 ? right : left;
  const time = (right.fetchedAt || right.observedAt).localeCompare(left.fetchedAt || left.observedAt);
  if (time) return time > 0 ? right : left;
  return (right.contractSymbol || '').localeCompare(left.contractSymbol || '') > 0 ? right : left;
};

export function analyzeOptionChain(contracts: MarketSnapshot[]): OptionChainAnalysis | undefined {
  const valid = contracts.filter((item) => item.optionSide && item.strike !== undefined && Number.isFinite(item.strike));
  if (!valid.length) return undefined;
  const reference = [...valid].sort((a, b) => (b.fetchedAt || b.observedAt).localeCompare(a.fetchedAt || a.observedAt) || (a.contractSymbol || '').localeCompare(b.contractSymbol || ''))[0];
  const underlyingPrice = reference.underlyingPrice ?? valid.find((item) => item.underlyingPrice !== undefined)?.underlyingPrice;
  const strikes = [...new Set(valid.map((item) => item.strike!))].sort((a, b) => a - b);
  // On an exact distance tie, the lower strike wins so the ATM marker is stable.
  const atmStrike = underlyingPrice === undefined ? undefined : strikes.reduce((nearest, strike) => Math.abs(strike - underlyingPrice) < Math.abs(nearest - underlyingPrice) ? strike : nearest, strikes[0]);
  const grouped = new Map<number, { call?: MarketSnapshot; put?: MarketSnapshot }>();
  for (const contract of valid) {
    const row = grouped.get(contract.strike!) || {};
    const key = contract.optionSide!;
    row[key] = row[key] ? preferredContract(row[key]!, contract) : contract;
    grouped.set(contract.strike!, row);
  }
  const rows = strikes.map((strike) => ({ strike, ...grouped.get(strike), atm: strike === atmStrike }));
  const atm = rows.find((row) => row.atm);
  const callMidpoint = optionMidpoint(atm?.call);
  const putMidpoint = optionMidpoint(atm?.put);
  const move = callMidpoint !== undefined && putMidpoint !== undefined && underlyingPrice !== undefined && underlyingPrice > 0
    ? straddleImpliedMove(callMidpoint, putMidpoint, underlyingPrice)
    : undefined;
  return {
    ticker: reference.ticker,
    expiration: reference.expiration || valid.find((item) => item.expiration)?.expiration,
    underlyingPrice,
    provider: reference.provider,
    freshness: reference.freshness,
    observedAt: reference.observedAt || undefined,
    fetchedAt: reference.fetchedAt || undefined,
    sourceReference: reference.sourceReference,
    methodology: reference.methodology,
    contractCount: valid.length,
    atmStrike,
    rows,
    atmSummary: move && callMidpoint !== undefined && putMidpoint !== undefined ? { callMidpoint, putMidpoint, ...move } : undefined,
  };
}
