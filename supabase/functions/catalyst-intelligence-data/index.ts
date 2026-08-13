import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

type JsonRecord = Record<string, unknown>;
type GatewayResult = { provider: string; capability: string; sourceReference: string; sourceQuality: 'official' | 'secondary'; observedAt?: string; fetchedAt: string; freshness: 'current' | 'delayed' | 'historical'; data: unknown; methodology: string };

const allowedOrigins = new Set([Deno.env.get('OJ_ALLOWED_ORIGIN') || 'https://dkyaya.github.io', 'http://localhost:5173']);
const maxBodyBytes = 4096;
const maxResponseBytes = 2_000_000;
const allowedBlsSeries = new Set(['CUUR0000SA0', 'CES0000000001', 'LNS14000000', 'WPUFD4']);
const allowedFredSeries = new Set(['DGS2', 'DGS10', 'FEDFUNDS', 'CPIAUCSL', 'UNRATE']);
const allowedBeaTables = new Set(['T10101', 'T20305']);

const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
};

const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsFor(req), 'content-type': 'application/json', 'cache-control': 'no-store' },
});

const object = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const integer = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? value : Number.isInteger(Number(value)) ? Number(value) : NaN;
const at = (value: unknown, index: number) => Array.isArray(value) ? value[index] : undefined;
const numberAt = (value: unknown, index?: number) => {
  const candidate = index === undefined ? value : at(value, index);
  const parsed = typeof candidate === 'number' ? candidate : typeof candidate === 'string' && candidate !== '' ? Number(candidate) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const exactKeys = (value: JsonRecord, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const exactDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));
const ticker = (value: unknown) => /^[A-Z0-9._-]{1,20}$/.test(text(value).toUpperCase()) ? text(value).toUpperCase() : '';

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchText(url: URL, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8', ...headers }, signal: controller.signal });
    if (response.status === 429) throw new Error('provider_quota_exhausted');
    if (!response.ok) throw new Error(response.status >= 500 ? 'provider_unavailable' : 'provider_request_rejected');
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxResponseBytes) throw new Error('provider_response_too_large');
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

const parseJson = (body: string) => {
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== 'object') throw new Error('provider_malformed_response');
  return parsed;
};

const providerStatuses = () => [
  { id: 'manual', label: 'Manual', availability: 'manual_only', freshness: 'manual', detail: 'Always available; source and timestamp are user supplied.' },
  { id: 'marketdata', label: 'MarketData', availability: Deno.env.get('MARKETDATA_API_KEY') ? 'available' : 'configuration_needed', freshness: 'delayed', detail: 'Free-tier delayed options. One expiration, at most 10 nearby strikes, and a four-request rolling daily guard.' },
  { id: 'bls', label: 'BLS', availability: 'available', freshness: 'varies', detail: 'Official public V1 series endpoint.' },
  { id: 'treasury', label: 'U.S. Treasury', availability: 'available', freshness: 'varies', detail: 'Official public yield-curve feed.' },
  { id: 'sec', label: 'SEC EDGAR', availability: Deno.env.get('SEC_USER_AGENT') ? 'available' : 'configuration_needed', freshness: 'varies', detail: 'Public filings require a compliant request identity.' },
  { id: 'fred', label: 'FRED', availability: Deno.env.get('FRED_API_KEY') ? 'available' : 'configuration_needed', freshness: 'varies', detail: 'Free API key required. FRED attribution applies.' },
  { id: 'bea', label: 'BEA', availability: Deno.env.get('BEA_API_KEY') ? 'available' : 'configuration_needed', freshness: 'varies', detail: 'Free API key required.' },
  { id: 'census', label: 'Census', availability: Deno.env.get('CENSUS_API_KEY') ? 'available' : 'configuration_needed', freshness: 'varies', detail: 'Free API key required for current access.' },
];

async function marketDataOptions(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['ticker', 'expiration', 'side', 'strikeLimit', 'date'])) throw new Error('invalid_request');
  const symbol = ticker(payload.ticker);
  const expiration = text(payload.expiration);
  const side = text(payload.side);
  const strikeLimit = integer(payload.strikeLimit);
  if (!symbol || !exactDate(expiration) || expiration === 'all' || !Number.isInteger(strikeLimit) || strikeLimit < 1 || strikeLimit > 10 || (side && !['call', 'put'].includes(side)) || (payload.date !== undefined && !exactDate(payload.date))) throw new Error('narrow_options_request_required');
  const key = Deno.env.get('MARKETDATA_API_KEY');
  if (!key) throw new Error('provider_configuration_needed');
  const url = new URL(`https://api.marketdata.app/v1/options/chain/${encodeURIComponent(symbol)}/`);
  url.searchParams.set('expiration', expiration);
  url.searchParams.set('strikeLimit', String(strikeLimit));
  if (side) url.searchParams.set('side', side);
  if (payload.date) url.searchParams.set('date', text(payload.date));
  url.searchParams.set('token', key);
  const raw = object(parseJson(await fetchText(url)));
  if (raw.s === 'no_data') return { provider: 'marketdata', capability: 'options_chain', sourceReference: 'https://www.marketdata.app/docs/api/options/chain/', sourceQuality: 'secondary', fetchedAt, freshness: payload.date ? 'historical' : 'delayed', data: [], methodology: 'Narrow option-chain request returned no contracts.' };
  if (raw.s && raw.s !== 'ok') throw new Error('provider_request_rejected');
  const optionSymbols = Array.isArray(raw.optionSymbol) ? raw.optionSymbol : [];
  if (optionSymbols.length > strikeLimit * (side ? 1 : 2) + 2) throw new Error('provider_scope_exceeded');
  const updated = numberAt(raw.updated, 0);
  const observedAt = updated ? new Date(updated * 1000).toISOString() : fetchedAt;
  const rows = optionSymbols.map((contract, index) => {
    const bid = numberAt(raw.bid, index);
    const ask = numberAt(raw.ask, index);
    return {
      provider: 'marketdata', sourceReference: 'https://www.marketdata.app/docs/api/options/chain/', sourceQuality: 'secondary', observedAt, fetchedAt,
      freshness: payload.date ? 'historical' : 'delayed', ticker: symbol, assetType: 'option', underlyingPrice: numberAt(raw.underlyingPrice, index) ?? numberAt(raw.underlyingPrice),
      expiration: text(at(raw.expiration, index)) || expiration, contractSymbol: String(contract), optionSide: text(at(raw.side, index)) || undefined,
      strike: numberAt(raw.strike, index), bid, ask, midpoint: bid !== undefined && ask !== undefined && ask >= bid ? (bid + ask) / 2 : undefined,
      last: numberAt(raw.last, index), volume: numberAt(raw.volume, index), openInterest: numberAt(raw.openInterest, index), impliedVolatility: numberAt(raw.iv, index),
      delta: numberAt(raw.delta, index), gamma: numberAt(raw.gamma, index), theta: numberAt(raw.theta, index), vega: numberAt(raw.vega, index),
      methodology: 'Normalized from a narrowly filtered MarketData option-chain response. Free-tier quotes are delayed.', provenance: 'provider',
    };
  });
  return { provider: 'marketdata', capability: 'options_chain', sourceReference: 'https://www.marketdata.app/docs/api/options/chain/', sourceQuality: 'secondary', observedAt, fetchedAt, freshness: payload.date ? 'historical' : 'delayed', data: rows, methodology: 'One ticker, one exact expiration, and a maximum of 10 nearby strikes. No polling.' };
}

async function blsSeries(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['seriesId']) || !allowedBlsSeries.has(text(payload.seriesId))) throw new Error('unsupported_series');
  const seriesId = text(payload.seriesId);
  const raw = object(parseJson(await fetchText(new URL(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`))));
  const series = object((object(raw.Results).series as unknown[] | undefined)?.[0]);
  const rows = Array.isArray(series.data) ? series.data.slice(0, 36) : [];
  return { provider: 'bls', capability: 'macro_series', sourceReference: 'https://www.bls.gov/developers/', sourceQuality: 'official', fetchedAt, freshness: 'historical', data: { seriesId, observations: rows }, methodology: 'Official BLS public V1 time-series observations; allowlisted series only.' };
}

async function treasuryRates(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['year'])) throw new Error('invalid_request');
  const year = integer(payload.year);
  if (year < 1990 || year > new Date().getUTCFullYear()) throw new Error('unsupported_period');
  const url = new URL('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml');
  url.searchParams.set('data', 'daily_treasury_yield_curve');
  url.searchParams.set('field_tdr_date_value', String(year));
  const xml = await fetchText(url, { accept: 'application/xml, text/xml' });
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(-40).map((match) => {
    const value = (name: string) => match[1].match(new RegExp(`<d:${name}[^>]*>([^<]*)<\\/d:${name}>`))?.[1];
    return { date: value('NEW_DATE'), oneMonth: value('BC_1MONTH'), threeMonth: value('BC_3MONTH'), twoYear: value('BC_2YEAR'), tenYear: value('BC_10YEAR') };
  });
  return { provider: 'treasury', capability: 'treasury_rates', sourceReference: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates', sourceQuality: 'official', fetchedAt, freshness: 'historical', data: { year, observations: entries }, methodology: 'Official Treasury daily par-yield observations; nearby maturity must be identified when used as a pricing input.' };
}

async function secFilings(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['cik']) || !/^\d{1,10}$/.test(text(payload.cik))) throw new Error('invalid_cik');
  const identity = text(Deno.env.get('SEC_USER_AGENT'));
  if (!identity) throw new Error('provider_configuration_needed');
  const cik = text(payload.cik).padStart(10, '0');
  const raw = object(parseJson(await fetchText(new URL(`https://data.sec.gov/submissions/CIK${cik}.json`), { 'user-agent': identity })));
  const recent = object(object(raw.filings).recent);
  const forms = Array.isArray(recent.form) ? recent.form : [];
  const filings = forms.slice(0, 40).map((form, index) => ({ form, filingDate: at(recent.filingDate, index), accessionNumber: at(recent.accessionNumber, index), primaryDocument: at(recent.primaryDocument, index) }));
  return { provider: 'sec', capability: 'company_filings', sourceReference: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', sourceQuality: 'official', fetchedAt, freshness: 'current', data: { cik, company: raw.name, filings }, methodology: 'Official SEC submissions API; filing dates are not assumed to be earnings-event timestamps.' };
}

async function fredSeries(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['seriesId', 'limit']) || !allowedFredSeries.has(text(payload.seriesId))) throw new Error('unsupported_series');
  const key = Deno.env.get('FRED_API_KEY');
  if (!key) throw new Error('provider_configuration_needed');
  const limit = payload.limit === undefined ? 60 : integer(payload.limit);
  if (limit < 1 || limit > 120) throw new Error('invalid_limit');
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', text(payload.seriesId)); url.searchParams.set('api_key', key); url.searchParams.set('file_type', 'json'); url.searchParams.set('sort_order', 'desc'); url.searchParams.set('limit', String(limit));
  const raw = object(parseJson(await fetchText(url)));
  return { provider: 'fred', capability: 'macro_series', sourceReference: 'https://fred.stlouisfed.org/docs/api/', sourceQuality: 'official', fetchedAt, freshness: 'historical', data: { seriesId: text(payload.seriesId), observations: Array.isArray(raw.observations) ? raw.observations : [] }, methodology: 'FRED observations with explicit series and bounded history. This product uses the FRED API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.' };
}

async function beaData(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['tableName', 'year']) || !allowedBeaTables.has(text(payload.tableName)) || !/^\d{4}$/.test(text(payload.year))) throw new Error('unsupported_dataset');
  const key = Deno.env.get('BEA_API_KEY');
  if (!key) throw new Error('provider_configuration_needed');
  const url = new URL('https://apps.bea.gov/api/data/');
  const params = { UserID: key, method: 'GetData', datasetname: 'NIPA', TableName: text(payload.tableName), Frequency: 'Q', Year: text(payload.year), ResultFormat: 'JSON' };
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const raw = object(parseJson(await fetchText(url)));
  return { provider: 'bea', capability: 'macro_series', sourceReference: 'https://apps.bea.gov/api/', sourceQuality: 'official', fetchedAt, freshness: 'historical', data: raw.BEAAPI ?? raw, methodology: 'Official BEA NIPA response; dataset and tables are allowlisted.' };
}

async function censusData(payload: JsonRecord, fetchedAt: string): Promise<GatewayResult> {
  if (!exactKeys(payload, ['year', 'state'])) throw new Error('invalid_request');
  const key = Deno.env.get('CENSUS_API_KEY');
  if (!key) throw new Error('provider_configuration_needed');
  const year = integer(payload.year);
  const state = text(payload.state);
  if (year < 2020 || year > new Date().getUTCFullYear() || !/^\d{2}$/.test(state)) throw new Error('unsupported_dataset');
  const url = new URL(`https://api.census.gov/data/${year}/acs/acs5/profile`);
  url.searchParams.set('get', 'NAME,DP05_0001E'); url.searchParams.set('for', `state:${state}`); url.searchParams.set('key', key);
  const raw = parseJson(await fetchText(url));
  return { provider: 'census', capability: 'macro_series', sourceReference: 'https://www.census.gov/data/developers.html', sourceQuality: 'official', fetchedAt, freshness: 'historical', data: raw, methodology: 'Official ACS five-year profile population observation; narrow state query only.' };
}

const actionConfiguration: Record<string, { provider: string; capability: string; ttlMs: number; handler: (payload: JsonRecord, fetchedAt: string) => Promise<GatewayResult> }> = {
  options_chain: { provider: 'marketdata', capability: 'options_chain', ttlMs: 30 * 60_000, handler: marketDataOptions },
  bls_series: { provider: 'bls', capability: 'macro_series', ttlMs: 6 * 60 * 60_000, handler: blsSeries },
  treasury_rates: { provider: 'treasury', capability: 'treasury_rates', ttlMs: 12 * 60 * 60_000, handler: treasuryRates },
  sec_filings: { provider: 'sec', capability: 'company_filings', ttlMs: 30 * 60_000, handler: secFilings },
  fred_series: { provider: 'fred', capability: 'macro_series', ttlMs: 6 * 60 * 60_000, handler: fredSeries },
  bea_data: { provider: 'bea', capability: 'macro_series', ttlMs: 12 * 60 * 60_000, handler: beaData },
  census_population: { provider: 'census', capability: 'macro_series', ttlMs: 24 * 60 * 60_000, handler: censusData },
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'forbidden_origin' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  if (Number(req.headers.get('content-length') || 0) > maxBodyBytes) return json(req, { error: 'request_too_large' }, 413);

  try {
    const authorization = req.headers.get('authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const backendSecret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization) return json(req, { error: 'authentication_required' }, 401);
    if (!url || !publishableKey || !backendSecret) return json(req, { error: 'server_configuration_incomplete' }, 503);
    const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(req, { error: 'authentication_required' }, 401);
    const admin = createClient(url, backendSecret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from('profiles').select('approved,account_status').eq('id', user.id).maybeSingle();
    if (!profile?.approved || profile.account_status !== 'active') return json(req, { error: 'approved_account_required' }, 403);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return json(req, { error: 'request_too_large' }, 413);
    const body = object(JSON.parse(rawBody));
    if (!exactKeys(body, ['action', 'payload'])) return json(req, { error: 'invalid_request' }, 400);
    const action = text(body.action);
    if (action === 'status') return json(req, { providers: providerStatuses(), zeroRecurringCost: true, polling: false });
    const configuration = actionConfiguration[action];
    if (!configuration) return json(req, { error: 'unsupported_action' }, 400);
    const payload = object(body.payload);
    const historical = action === 'options_chain' && Boolean(payload.date);
    const fingerprint = { action, payload };
    const cacheKey = await sha256(JSON.stringify(fingerprint));
    const now = new Date();
    const cached = await admin.from('catalyst_provider_cache').select('normalized_payload,fetched_at,expires_at').eq('user_id', user.id).eq('cache_key', cacheKey).gt('expires_at', now.toISOString()).maybeSingle();
    if (cached.error) return json(req, { error: 'cache_unavailable' }, 503);
    if (cached.data) return json(req, { result: cached.data.normalized_payload, cache: { hit: true, fetchedAt: cached.data.fetched_at } });

    if (action === 'options_chain') {
      const rollingDay = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      const recentMarketData = await admin.from('catalyst_provider_cache').select('id', { count: 'exact', head: true }).eq('provider', 'marketdata').gte('fetched_at', rollingDay);
      if (recentMarketData.error) return json(req, { error: 'cache_unavailable' }, 503);
      if ((recentMarketData.count || 0) >= 4) return json(req, { error: 'provider_quota_guard' }, 429);
    }

    const result = await configuration.handler(payload, now.toISOString());
    const expiresAt = new Date(historical ? Date.UTC(2099, 0, 1) : now.getTime() + configuration.ttlMs).toISOString();
    const stored = await admin.from('catalyst_provider_cache').upsert({ user_id: user.id, provider: configuration.provider, capability: configuration.capability, cache_key: cacheKey, request_fingerprint: fingerprint, normalized_payload: result, observed_at: result.observedAt || null, fetched_at: now.toISOString(), expires_at: expiresAt, historical }, { onConflict: 'user_id,cache_key' });
    if (stored.error) return json(req, { error: 'cache_write_failed' }, 503);
    return json(req, { result, cache: { hit: false, fetchedAt: now.toISOString() } });
  } catch (error) {
    const code = error instanceof SyntaxError ? 'invalid_json' : error instanceof DOMException && error.name === 'AbortError' ? 'provider_timeout' : error instanceof Error ? error.message : 'provider_request_failed';
    const safe = new Set(['invalid_json', 'invalid_request', 'narrow_options_request_required', 'unsupported_series', 'unsupported_period', 'invalid_cik', 'invalid_limit', 'unsupported_dataset', 'provider_configuration_needed', 'provider_quota_exhausted', 'provider_quota_guard', 'provider_unavailable', 'provider_request_rejected', 'provider_response_too_large', 'provider_malformed_response', 'provider_scope_exceeded', 'provider_timeout']);
    const status = code === 'provider_configuration_needed' ? 503 : code === 'provider_quota_exhausted' || code === 'provider_quota_guard' ? 429 : code.startsWith('provider_') ? 502 : 400;
    console.error(safe.has(code) ? code : 'provider_request_failed');
    return json(req, { error: safe.has(code) ? code : 'provider_request_failed' }, status);
  }
});
