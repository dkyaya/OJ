import type { DataFreshness, DataQuality } from './types';

const valid = (...values: number[]) => values.every(Number.isFinite);

export function midpoint(bid?: number, ask?: number) {
  if (bid === undefined || ask === undefined || !valid(bid, ask) || bid < 0 || ask < bid) return undefined;
  return (bid + ask) / 2;
}

export function spreadQuoteMetrics(bid?: number, ask?: number) {
  const mid = midpoint(bid, ask);
  if (mid === undefined) return undefined;
  const width = ask! - bid!;
  return { midpoint: mid, width, widthPercentOfMidpoint: mid === 0 ? undefined : (width / mid) * 100 };
}

export function straddleImpliedMove(callMid: number, putMid: number, spot: number) {
  if (!valid(callMid, putMid, spot) || callMid < 0 || putMid < 0 || spot <= 0) return undefined;
  const dollarMove = callMid + putMid;
  return { dollarMove, percentMove: (dollarMove / spot) * 100 };
}

export function volatilityImpliedMove(spot: number, annualIv: number, daysToMaturity: number, daysInYear = 365) {
  if (!valid(spot, annualIv, daysToMaturity, daysInYear) || spot <= 0 || annualIv < 0 || daysToMaturity < 0 || daysInYear <= 0) return undefined;
  const dollarMove = spot * annualIv * Math.sqrt(daysToMaturity / daysInYear);
  return { dollarMove, percentMove: (dollarMove / spot) * 100 };
}

export function ivContext(currentIv: number, history: number[]) {
  const observations = history.filter((value) => Number.isFinite(value) && value >= 0);
  if (!Number.isFinite(currentIv) || currentIv < 0 || observations.length < 2) return undefined;
  const low = Math.min(...observations);
  const high = Math.max(...observations);
  return {
    currentIv,
    low,
    high,
    count: observations.length,
    rank: high === low ? undefined : ((currentIv - low) / (high - low)) * 100,
    percentile: (observations.filter((value) => value < currentIv).length / observations.length) * 100,
  };
}

export function realizedMove(startPrice: number, endPrice: number) {
  if (!valid(startPrice, endPrice) || startPrice <= 0 || endPrice < 0) return undefined;
  const signedPercent = ((endPrice - startPrice) / startPrice) * 100;
  return { signedPercent, absolutePercent: Math.abs(signedPercent) };
}

export const preEventDrift = realizedMove;

export function incrementalEventVariance(longerIv: number, longerDays: number, shorterIv: number, shorterDays: number, daysInYear = 365) {
  if (!valid(longerIv, longerDays, shorterIv, shorterDays, daysInYear) || longerIv < 0 || shorterIv < 0 || shorterDays < 0 || longerDays <= shorterDays || daysInYear <= 0) return undefined;
  const longerTotalVariance = longerIv ** 2 * (longerDays / daysInYear);
  const shorterTotalVariance = shorterIv ** 2 * (shorterDays / daysInYear);
  const incrementalVariance = longerTotalVariance - shorterTotalVariance;
  if (incrementalVariance < 0) return undefined;
  const intervalYears = (longerDays - shorterDays) / daysInYear;
  return {
    longerTotalVariance,
    shorterTotalVariance,
    incrementalVariance,
    intervalAnnualizedVolatility: Math.sqrt(incrementalVariance / intervalYears),
  };
}

export function estimatedEventPremium(totalVariance: number, baselineAnnualVolatility: number, eventWindowDays: number, daysInYear = 365) {
  if (!valid(totalVariance, baselineAnnualVolatility, eventWindowDays, daysInYear) || totalVariance < 0 || baselineAnnualVolatility < 0 || eventWindowDays <= 0 || daysInYear <= 0) return undefined;
  const baselineVariance = baselineAnnualVolatility ** 2 * (eventWindowDays / daysInYear);
  return { baselineVariance, estimatedEventVariance: Math.max(0, totalVariance - baselineVariance) };
}

export function calibrationStats(observations: Array<{ impliedMove: number; realizedMove: number; preEventDrift?: number }>) {
  const validRows = observations.filter((item) => valid(item.impliedMove, item.realizedMove) && item.impliedMove >= 0 && item.realizedMove >= 0);
  if (!validRows.length) return undefined;
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const drifts = validRows.map((item) => item.preEventDrift).filter((value): value is number => value !== undefined && Number.isFinite(value));
  return {
    count: validRows.length,
    averageImpliedMove: average(validRows.map((item) => item.impliedMove)),
    averageRealizedMove: average(validRows.map((item) => item.realizedMove)),
    averageAbsoluteError: average(validRows.map((item) => Math.abs(item.realizedMove - item.impliedMove))),
    exceedanceRate: (validRows.filter((item) => item.realizedMove > item.impliedMove).length / validRows.length) * 100,
    averagePreEventDrift: drifts.length ? average(drifts) : undefined,
  };
}

export function dataQuality(input: { sourceQuality: 'official' | 'primary' | 'secondary' | 'unverified'; freshness: DataFreshness; sampleCount?: number; requiredFieldsPresent: number; requiredFieldCount: number }): DataQuality {
  if (input.requiredFieldCount <= 0 || input.requiredFieldsPresent < input.requiredFieldCount * 0.5) return 'insufficient';
  let score = input.sourceQuality === 'official' ? 3 : input.sourceQuality === 'primary' ? 2 : input.sourceQuality === 'secondary' ? 1 : 0;
  score += input.freshness === 'current' || input.freshness === 'historical' ? 2 : input.freshness === 'manual' ? 1 : 0;
  if ((input.sampleCount ?? 0) >= 8) score += 2;
  else if ((input.sampleCount ?? 0) >= 4) score += 1;
  if (score >= 6) return 'strong';
  if (score >= 4) return 'moderate';
  return 'limited';
}
