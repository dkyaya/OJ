import { spreadMetrics } from '../payoff';
import type { OptionSide, OptionStyle, VerticalStrategy } from './types';

export type OptionModelInput = {
  spot: number;
  strike: number;
  timeYears: number;
  volatility: number;
  riskFreeRate: number;
  dividendYield?: number;
  side: OptionSide;
  style?: OptionStyle;
  steps?: number;
};

const intrinsic = (spot: number, strike: number, side: OptionSide) => side === 'call' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);

export function binomialOptionPrice(input: OptionModelInput) {
  const { spot, strike, timeYears, volatility, riskFreeRate, side } = input;
  const dividendYield = input.dividendYield ?? 0;
  const style = input.style ?? 'american';
  const steps = input.steps ?? 200;
  if (![spot, strike, timeYears, volatility, riskFreeRate, dividendYield].every(Number.isFinite) || spot <= 0 || strike <= 0 || timeYears < 0 || volatility < 0 || !Number.isInteger(steps) || steps < 1 || steps > 2000) return undefined;
  if (timeYears === 0) return intrinsic(spot, strike, side);
  if (volatility === 0) {
    const forwardSpot = spot * Math.exp((riskFreeRate - dividendYield) * timeYears);
    return Math.exp(-riskFreeRate * timeYears) * intrinsic(forwardSpot, strike, side);
  }
  const dt = timeYears / steps;
  const up = Math.exp(volatility * Math.sqrt(dt));
  const down = 1 / up;
  const growth = Math.exp((riskFreeRate - dividendYield) * dt);
  const probability = (growth - down) / (up - down);
  if (probability < 0 || probability > 1 || !Number.isFinite(probability)) return undefined;
  const discount = Math.exp(-riskFreeRate * dt);
  const values = Array.from({ length: steps + 1 }, (_, index) => intrinsic(spot * up ** index * down ** (steps - index), strike, side));
  for (let step = steps - 1; step >= 0; step -= 1) {
    for (let index = 0; index <= step; index += 1) {
      const continuation = discount * (probability * values[index + 1] + (1 - probability) * values[index]);
      const exercise = intrinsic(spot * up ** index * down ** (step - index), strike, side);
      values[index] = style === 'american' ? Math.max(continuation, exercise) : continuation;
    }
  }
  return values[0];
}

export function impliedVolatilityFromPrice(price: number, input: Omit<OptionModelInput, 'volatility'>, bounds = { low: 0.0001, high: 5 }) {
  if (!Number.isFinite(price) || price < 0 || input.spot <= 0 || input.strike <= 0 || input.timeYears <= 0 || bounds.low <= 0 || bounds.high <= bounds.low) return undefined;
  const lowerBound = input.side === 'call'
    ? Math.max(0, input.spot * Math.exp(-(input.dividendYield ?? 0) * input.timeYears) - input.strike * Math.exp(-input.riskFreeRate * input.timeYears))
    : Math.max(0, input.strike * Math.exp(-input.riskFreeRate * input.timeYears) - input.spot * Math.exp(-(input.dividendYield ?? 0) * input.timeYears));
  const upperBound = input.side === 'call' ? input.spot : input.strike;
  if (price < lowerBound - 1e-8 || price > upperBound + 1e-8) return undefined;
  let low = bounds.low;
  let high = bounds.high;
  let lowPrice = binomialOptionPrice({ ...input, volatility: low });
  while (lowPrice === undefined && low < high) {
    low *= 2;
    lowPrice = binomialOptionPrice({ ...input, volatility: low });
  }
  const highPrice = binomialOptionPrice({ ...input, volatility: high });
  if (lowPrice === undefined || highPrice === undefined || price < lowPrice || price > highPrice) return undefined;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mid = (low + high) / 2;
    const modelPrice = binomialOptionPrice({ ...input, volatility: mid });
    if (modelPrice === undefined) return undefined;
    if (Math.abs(modelPrice - price) < 1e-6) return mid;
    if (modelPrice > price) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

export type VerticalValueInput = {
  strategy: VerticalStrategy;
  spot: number;
  longStrike: number;
  shortStrike: number;
  debit: number;
  contracts?: number;
  timeYears: number;
  volatility: number;
  riskFreeRate: number;
  dividendYield?: number;
  style?: OptionStyle;
  steps?: number;
};

export function scenarioSpreadValue(input: VerticalValueInput) {
  const contracts = input.contracts ?? 1;
  const economics = spreadMetrics(input.strategy, input.longStrike, input.shortStrike, input.debit, contracts);
  if (!economics || input.timeYears < 0) return undefined;
  const side: OptionSide = input.strategy === 'bull-call-spread' ? 'call' : 'put';
  let theoreticalValue: number;
  if (input.timeYears === 0) {
    const longIntrinsic = intrinsic(input.spot, input.longStrike, side);
    const shortIntrinsic = intrinsic(input.spot, input.shortStrike, side);
    theoreticalValue = Math.max(0, longIntrinsic - shortIntrinsic);
  } else {
    const common = { spot: input.spot, timeYears: input.timeYears, volatility: input.volatility, riskFreeRate: input.riskFreeRate, dividendYield: input.dividendYield, side, style: input.style, steps: input.steps };
    const longValue = binomialOptionPrice({ ...common, strike: input.longStrike });
    const shortValue = binomialOptionPrice({ ...common, strike: input.shortStrike });
    if (longValue === undefined || shortValue === undefined) return undefined;
    theoreticalValue = Math.max(0, longValue - shortValue);
  }
  const profitLoss = (theoreticalValue - input.debit) * 100 * contracts;
  return {
    theoreticalValue,
    profitLoss,
    returnOnRisk: economics.maxLoss === 0 ? null : (profitLoss / economics.maxLoss) * 100,
    economics,
    methodology: input.timeYears === 0 ? 'Exact vertical payoff at expiration.' : 'CRR theoretical mark estimate; not an executable quote.',
    assumptions: { dividendYield: input.dividendYield ?? 0, style: input.style ?? 'american', steps: input.steps ?? 200 },
  };
}
