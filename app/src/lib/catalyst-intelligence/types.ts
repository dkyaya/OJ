export type DataFreshness = 'current' | 'delayed' | 'historical' | 'manual';
export type DataQuality = 'strong' | 'moderate' | 'limited' | 'insufficient';
export type OptionSide = 'call' | 'put';
export type OptionStyle = 'american' | 'european';
export type TradingSessionLabel = 'T-5' | 'T-3' | 'T-1' | 'T0' | 'T+1' | 'T+5';

export type MarketSnapshot = {
  provider: string;
  sourceReference?: string;
  sourceQuality: 'official' | 'primary' | 'secondary' | 'unverified';
  observedAt: string;
  fetchedAt: string;
  freshness: DataFreshness;
  ticker: string;
  assetType?: string;
  underlyingPrice?: number;
  expiration?: string;
  contractSymbol?: string;
  optionSide?: OptionSide;
  strike?: number;
  bid?: number;
  ask?: number;
  midpoint?: number;
  last?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  methodology: string;
  provenance: 'provider' | 'manual';
  sessionLabel?: TradingSessionLabel;
  sourceDate?: string;
  calendarDaysToCatalyst?: number;
  catalystTimezone?: string;
  catalystSession?: string;
};

export type ProviderCapability =
  | 'delayed_options'
  | 'historical_options'
  | 'macro_series'
  | 'company_filings'
  | 'treasury_rates';

export type ProviderStatus = {
  id: string;
  label: string;
  availability: 'available' | 'configuration_needed' | 'manual_only';
  freshness: DataFreshness | 'varies';
  capabilities: ProviderCapability[];
  detail: string;
};

export type VerticalStrategy = 'bull-call-spread' | 'bear-put-spread';

export type ScenarioInput = {
  id: string;
  label: string;
  probability: number;
  targetPrice?: number;
  movePercent?: number;
  targetIv: number;
  evaluationDate: string;
  notes?: string;
};

export type ScenarioResult = ScenarioInput & {
  scenarioPrice: number;
  theoreticalValue: number;
  profitLoss: number;
  returnOnRisk: number | null;
  weightedContribution: number;
};
