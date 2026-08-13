import type { MarketSnapshot } from '../../lib/catalyst-intelligence/types';

const strikes = [110, 112, 114, 116, 118, 120];

export const wmtOptionChainFixture: MarketSnapshot[] = strikes.flatMap((strike, strikeIndex) => (['call', 'put'] as const).map((optionSide) => {
  const distance = Math.abs(strike - 116);
  const bid = Number((1.05 + distance * 0.28 + (optionSide === 'call' ? Math.max(116 - strike, 0) * 0.55 : Math.max(strike - 116, 0) * 0.55)).toFixed(2));
  return {
    provider: 'fixture-provider',
    sourceReference: 'Synthetic delayed-provider fixture',
    sourceQuality: 'secondary',
    observedAt: '2026-08-12T20:00:00Z',
    fetchedAt: '2026-08-13T03:57:00Z',
    freshness: 'delayed',
    ticker: 'WMT',
    underlyingPrice: 116.23,
    expiration: '2026-08-21',
    contractSymbol: `WMT-SYNTH-${strike}-${optionSide}`,
    optionSide,
    strike,
    bid,
    ask: Number((bid + 0.16).toFixed(2)),
    last: Number((bid + 0.06).toFixed(2)),
    volume: 120 + strikeIndex * 17,
    openInterest: 800 + strikeIndex * 91,
    impliedVolatility: 0.27 + distance * 0.002,
    delta: optionSide === 'call' ? 0.5 - (strike - 116) * 0.055 : -0.5 - (strike - 116) * 0.055,
    gamma: 0.041 - distance * 0.002,
    theta: -0.083 - distance * 0.003,
    vega: 0.091 - distance * 0.002,
    methodology: 'Synthetic normalized option-chain fixture; no provider request.',
    provenance: 'provider',
  };
}));
