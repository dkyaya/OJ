import type { MarketSnapshot } from '../../lib/catalyst-intelligence/types';

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export type TutorialFixture = {
  catalystDate: string;
  expiration: string;
  observedAt: string;
  options: MarketSnapshot[];
};

const contract = (
  fixture: Omit<TutorialFixture, 'options'>,
  optionSide: 'call' | 'put',
  strike: number,
  bid: number,
  ask: number,
  impliedVolatility: number,
): MarketSnapshot => ({
  provider: 'Tutorial Fixture',
  sourceReference: 'Bundled synthetic options snapshot',
  sourceQuality: 'unverified',
  observedAt: fixture.observedAt,
  fetchedAt: fixture.observedAt,
  freshness: 'manual',
  ticker: 'OJDEMO',
  assetType: 'Synthetic security',
  underlyingPrice: 100,
  expiration: fixture.expiration,
  contractSymbol: `OJDEMO-${fixture.expiration}-${strike}-${optionSide.toUpperCase()}`,
  optionSide,
  strike,
  bid,
  ask,
  impliedVolatility,
  volume: 100 + strike,
  openInterest: 500 + strike,
  methodology: 'Bundled synthetic tutorial fixture; no provider request made.',
  provenance: 'manual',
});

export function createTutorialFixture(now = new Date()): TutorialFixture {
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14));
  const fixture: Omit<TutorialFixture, 'options'> = {
    catalystDate: dateKey(addDays(base, 14)),
    expiration: dateKey(addDays(base, 21)),
    observedAt: base.toISOString(),
  };
  return {
    ...fixture,
    options: [
      contract(fixture, 'call', 95, 6.2, 6.6, 0.27),
      contract(fixture, 'put', 95, 1.15, 1.35, 0.26),
      contract(fixture, 'call', 100, 2.6, 2.8, 0.24),
      contract(fixture, 'put', 100, 2.4, 2.6, 0.24),
      contract(fixture, 'call', 105, 0.95, 1.15, 0.25),
      contract(fixture, 'put', 105, 5.9, 6.3, 0.28),
    ],
  };
}

export const tutorialStory = {
  company: 'OJ Tutorial Co.',
  ticker: 'OJDEMO',
  event: 'OJ Tutorial Co. Q2 Earnings',
  ideaTitle: 'Bullish earnings setup',
  strategy: 'Bull Call Spread',
  bias: 'Bullish',
  thesis: 'Confirmation above the post-earnings range could support a measured move higher.',
  evidence: 'The Tutorial Fixture shows event uncertainty without making a directional forecast.',
  entryConditions: 'Price holds above the confirmed support zone after the event.',
  invalidation: 'Close below the post-event support zone.',
  plannedExit: 'Review after the event and exit before the synthetic expiration.',
  longStrike: 100,
  shortStrike: 105,
  plannedDebit: 1.4,
  actualDebit: 1.32,
  contracts: 1,
  checkin: 'Price is holding above the post-entry support zone.',
  exitValue: 2.1,
  lesson: 'The Catalyst thesis strengthened after confirmation.',
};
